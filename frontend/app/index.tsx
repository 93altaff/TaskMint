import React, { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../src/context/AuthContext";
import HomeSkeleton from "../src/components/HomeSkeleton";

export default function Index() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (user) router.replace("/(tabs)/home");
    else router.replace("/login");
  }, [loading, user, router]);

  // Show the Home skeleton during auth hydration so the cold-start feels
  // like the app is loading the Home tab, not a blank/spinner gate.
  return <HomeSkeleton />;
}
