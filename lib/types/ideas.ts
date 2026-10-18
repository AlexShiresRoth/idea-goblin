// Where a new idea goes: "auto" lets the classifier pick, "new" creates a
// bucket, and a number is an existing bucket id.
export type BucketChoice = "auto" | "new" | number;

export type BucketOption = {
  id: number;
  name: string;
  theme: string;
};
