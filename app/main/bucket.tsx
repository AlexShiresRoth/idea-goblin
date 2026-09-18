import { getIdeas } from "@/lib/api/";
import { IdeaBucket } from "@/lib/db/schema";
import Ideas from "./ideas";

export default async function Bucket({ bucket }: { bucket: IdeaBucket }) {
  const ideas = await getIdeas(bucket.id);

  return <Ideas ideas={ideas} bucket={bucket} />;
}
