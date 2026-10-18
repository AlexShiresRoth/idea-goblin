-- Buckets that received ideas without being touched: move updated_at up to
-- their most recent linked idea so ordering reflects real activity.
UPDATE "idea_buckets" AS b
SET "updated_at" = latest.created_at
FROM (
	SELECT l."bucket_id", max(i."created_at") AS created_at
	FROM "idea_bucket_links" l
	JOIN "ideas" i ON i."id" = l."idea_id"
	GROUP BY l."bucket_id"
) AS latest
WHERE latest."bucket_id" = b."id" AND latest.created_at > b."updated_at";
