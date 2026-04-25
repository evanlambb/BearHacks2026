"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { runScoutPipelineNow } from "@/server/pipeline/runScoutPipelineNow";

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

export async function runScoutNowAction(scoutId: string) {
  const { supabase, user } = await requireUser();

  const { data: scout, error: scoutError } = await supabase
    .from("scouts")
    .select("id")
    .eq("id", scoutId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (scoutError) throw new Error(scoutError.message);
  if (!scout) throw new Error("Scout not found");

  await runScoutPipelineNow(scoutId);

  revalidatePath(`/scouts/${scoutId}`);
  revalidatePath("/scouts");
  revalidatePath("/dashboard");
}
