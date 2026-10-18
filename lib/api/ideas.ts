import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import "server-only";
import { db } from "@/lib/db";
import {
  ideaBucketLinksTable,
  ideaVersionsTable,
  ideasTable,
  type IdeaVersion,
  type IdeaView,
} from "../db/schema";

const ideaViewColumns = {
  id: ideasTable.id,
  title: ideasTable.title,
  status: ideasTable.status,
  profileId: ideasTable.profileId,
  category: ideasTable.category,
  type: ideasTable.type,
  description: ideasTable.description,
  parentId: ideasTable.parentId,
  createdAt: ideasTable.createdAt,
  updatedAt: ideasTable.updatedAt,
};

export async function getTopLevelIdeasForProfile(profileId: string) {
  return db
    .select(ideaViewColumns)
    .from(ideasTable)
    .where(
      and(eq(ideasTable.profileId, profileId), isNull(ideasTable.parentId)),
    );
}

export async function getIdeaVersions(ideaId: number): Promise<IdeaVersion[]> {
  return db
    .select()
    .from(ideaVersionsTable)
    .where(eq(ideaVersionsTable.ideaId, ideaId))
    .orderBy(desc(ideaVersionsTable.createdAt));
}

export async function getIdeasForBuckets(bucketIds: number[]) {
  const ideasByBucket = new Map<number, IdeaView[]>();

  if (bucketIds.length === 0) {
    return ideasByBucket;
  }

  const rows = await db
    .select({
      bucketId: ideaBucketLinksTable.bucketId,
      ...ideaViewColumns,
    })
    .from(ideaBucketLinksTable)
    .innerJoin(ideasTable, eq(ideasTable.id, ideaBucketLinksTable.ideaId))
    .where(inArray(ideaBucketLinksTable.bucketId, bucketIds));

  for (const row of rows) {
    const { bucketId, ...idea } = row;
    const list = ideasByBucket.get(bucketId) ?? [];
    list.push(idea);
    ideasByBucket.set(bucketId, list);
  }

  return ideasByBucket;
}
