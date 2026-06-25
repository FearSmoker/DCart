import createImageUrlBuilder from '@sanity/image-url'
import { SanityImageSource } from "@sanity/image-url/lib/types/types";

import { dataset, projectId } from '../env'

// https://www.sanity.io/docs/image-url
const builder = createImageUrlBuilder({ projectId, dataset })

export const urlFor = (source: SanityImageSource | string | unknown) => {
  if (typeof source === 'string') {
    return {
      url: () => source,
    } as unknown as ReturnType<typeof builder.image>;
  }
  if (!projectId || projectId === 'placeholder' || !source) {
    return {
      url: () => "/notFound.png",
    } as unknown as ReturnType<typeof builder.image>;
  }
  return builder.image(source)
}
