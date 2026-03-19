import { createServiceClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServiceClient();

  const { count } = await supabase
    .from("patient_profiles")
    .select("*", { count: "exact", head: true })
    .eq("assessment_completed", true);

  return Response.json({ count: count ?? 0 });
}
