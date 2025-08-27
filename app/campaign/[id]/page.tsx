"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Navigation } from "@/components/layout/navigation"
import { Footer } from "@/components/layout/footer"
import { createClient } from "@supabase/supabase-js"
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { useProgram } from "@/lib/hooks"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function CampaignDetails() {
  const { id } = useParams() // from /campaign/[id]
  const [campaign, setCampaign] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [amount, setAmount] = useState("")
  const wallet = useWallet()
  const program = useProgram();
  const { connection } = useConnection();
  // Fetch campaign from Supabase
  useEffect(() => {
    if (!id) return
    const fetchCampaign = async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", id)
        .single()

      if (error) {
        console.error("Error fetching campaign:", error)
      } else {
        setCampaign(data)
      }
      setLoading(false)
    }

    fetchCampaign()
  }, [id])

  const handleDonate = async () => {
    if (!wallet.publicKey) {
      alert("Please connect your wallet first!")
      return
    }

    try {
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: new PublicKey(campaign.pda),
          lamports: parseFloat(amount) * 1e9,
        })
      )

      const signature = await wallet.sendTransaction(tx, connection)
      console.log("Donation sent:", signature)
      alert("Donation successful!")

      await supabase
        .from("campaigns")
        .update({ raised: campaign.raised + parseFloat(amount) })
        .eq("id", id)

      // refresh campaign
      setCampaign((prev: any) => ({
        ...prev,
        raised: prev.raised + parseFloat(amount),
      }))
    } catch (err) {
      console.error("Donation failed:", err)
      alert("Transaction failed. Check console for details.")
    }
  }
  const refund = async () => {
    if (!program || !wallet.publicKey) {
      console.log("Program or wallet is missing");
      return;
    }

    const campaignPubkey = new PublicKey(campaign.pda);

    const [contributionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("contribution"),
        campaignPubkey.toBuffer(),
        wallet.publicKey.toBuffer(),
      ],
      program.programId
    );

    console.log("Found contribution PDA:", contributionPda.toBase58());

    try {
      // ✅ Check if the account exists on chain (raw fetch)
      // const contributionAcc = await program.account.contribution.fetch(contributionPda);

      // console.log("Contribution account state:", contributionAcc);

      // if (!contributionAcc) {
      //   alert("❌ No contribution found for this wallet.");
      //   return;
      // }

      // If account exists, proceed with refund
      await program.methods
        .refund()
        .accounts({
          contributor: wallet.publicKey,
          campaign: campaignPubkey,
          contribution: contributionPda,
        })
        .rpc();

      alert("✅ Refund successful!");
    } catch (err: any) {
      console.error("Refund failed", err);
      alert(`❌ Refund failed: ${err.message || err}`);
    }
  };


  if (loading) return <div className="p-8">Loading...</div>
  if (!campaign) return <div className="p-8">Campaign not found</div>
  const isClosed = campaign.raised >= campaign.goal

  const deadlineMs = Number(campaign.deadline) * 1000;

  const daysLeft = Math.ceil(
    (deadlineMs - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const isExpired = daysLeft <= 0;

  const progressPercentage = (campaign.raised / campaign.goal) * 100

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {isClosed ?

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-card-foreground">
              Campaign Closed
            </CardTitle>
            <CardDescription>
              This campaign has already reached its goal.
            </CardDescription>
          </CardHeader>
        </Card>
        : isExpired ? (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-card-foreground">
                Campaign Failed
              </CardTitle>
              <CardDescription>
                Goal was not met before the deadline.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => refund()} >Reclaim your donation </Button>
            </CardContent>
          </Card>
        ) :

          <div className="container mx-auto px-4 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* LEFT SIDE - Campaign Details */}
              <div className="space-y-6">
                <h1 className="text-3xl font-bold text-foreground">
                  {campaign.title}
                </h1>
                <p className="text-lg text-muted-foreground">
                  {campaign.short_description}
                </p>

                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-card-foreground">
                      About This Campaign
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      {campaign.long_description ||
                        "This campaign is using blockchain for transparent funding."}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-card-foreground">About the Creator</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-lg font-semibold text-primary">{campaign.creatorname}</p>
                    <p className="text-sm text-muted-foreground">{campaign.creatorbio}</p>
                  </CardContent>
                </Card>
              </div>

              {/* RIGHT SIDE - Progress + Donate */}
              <div className="space-y-6">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-card-foreground">
                      Campaign Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary mb-1">
                        {campaign.raised} SOL
                      </div>
                      <div className="text-sm text-muted-foreground">
                        of {campaign.goal} SOL goal
                      </div>
                    </div>

                    <Progress value={progressPercentage} className="h-3" />

                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{daysLeft} days left</span>
                      <span className="text-muted-foreground">
                        {Math.round(progressPercentage)}% funded
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-card-foreground">
                      Support This Campaign
                    </CardTitle>
                    <CardDescription>
                      Enter the amount of SOL you want to contribute
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-card-foreground">
                        Amount (SOL)
                      </label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="bg-input border-border"
                        min="0.1"
                        step="0.1"
                      />
                    </div>

                    <Button
                      className="w-full bg-primary hover:bg-primary/90"
                      size="lg"
                      onClick={handleDonate}
                    >
                      Donate Now
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                      Funds will be returned if goal isn't met by deadline
                    </p>
                  </CardContent>
                </Card>


              </div>
            </div>
          </div>

      }


      <Footer />
    </div>
  )
}
