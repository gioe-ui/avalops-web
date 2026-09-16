import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import Auth from "./Auth";
import AppLayout from "./AppLayout";
import PendingApproval from "./PendingApproval";

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%)" }}
      >
        <Loader2 className="w-10 h-10 animate-spin text-white" />
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  if (!user.approved) {
    return <PendingApproval />;
  }

  return <AppLayout />;
}
