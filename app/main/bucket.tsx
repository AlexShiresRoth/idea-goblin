import { IdeaBucket, IdeaView } from "@/lib/db/schema";
import Ideas from "./ideas-bucket";

export default function Bucket({
  bucket,
  ideas,
}: {
  bucket: IdeaBucket;
  ideas: IdeaView[];
}) {
  return <Ideas ideas={ideas} bucket={bucket} />;
}
