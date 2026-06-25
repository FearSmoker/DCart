export const apiVersion =
  process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2024-10-10'

export const dataset = assertValue(
  process.env.NEXT_PUBLIC_SANITY_DATASET,
  'production'
)

export const projectId = assertValue(
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  'placeholder'
)

function assertValue<T>(v: T | undefined, fallback: T): T {
  if (v === undefined || v === '') {
    return fallback;
  }

  return v;
}
