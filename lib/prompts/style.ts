export const GENERATED_COPY_STYLE = `
  For text you generate, use everyday words, active voice, and short sentences.
  State the main point first. Avoid jargon, buzzwords, filler, and sales language.
  Keep the user's meaning and useful specifics. Do not invent features, benefits, or audiences.
  Use plain text, not markdown headings or bullet lists.
  These writing limits apply only to generated text. Keep user-written titles,
  bucket names, and descriptions unchanged; do not shorten or rewrite them.
`.trim();

export const IDEA_TITLE_STYLE = `
  When generating an idea title, use at most eight words.
  Name the idea directly rather than adding a slogan or explanation.
`.trim();

export const BUCKET_OVERVIEW_STYLE = `
  When generating a bucket name, use at most eight words.
  Keep each generated bucket description to one or two short sentences, at most 35 words total.
  Say what the bucket is for and what its ideas have in common; do not list every idea.
  If the ideas are only loosely related, say so plainly instead of inventing a connection.
`.trim();
