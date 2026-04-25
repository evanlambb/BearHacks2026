"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";

export async function pauseScoutAction(scoutId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("scouts")
    .update({ status: "paused" })
    .eq("id", scoutId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/scouts/${scoutId}`);
  revalidatePath("/scouts");
  revalidatePath("/dashboard");
}

export async function resumeScoutAction(scoutId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("scouts")
    .update({ status: "active" })
    .eq("id", scoutId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/scouts/${scoutId}`);
  revalidatePath("/scouts");
  revalidatePath("/dashboard");
}
