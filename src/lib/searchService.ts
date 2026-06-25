import { Client } from "@elastic/elasticsearch";
import MiniSearch from "minisearch";
import { ProductData } from "../../types";
import { getProductsData } from "./getData";

let esClient: Client | null = null;
if (process.env.ELASTICSEARCH_URL) {
  esClient = new Client({
    node: process.env.ELASTICSEARCH_URL,
  });
}

async function syncProductsToElasticsearch(products: ProductData[]): Promise<void> {
  if (!esClient) return;
  try {
    const indexExists = await esClient.indices.exists({ index: "dcart_products" });
    if (!indexExists) {
      await esClient.indices.create({
        index: "dcart_products",
        mappings: {
          properties: {
            id: { type: "keyword" },
            title: { type: "text", analyzer: "standard" },
            brand: { type: "text" },
            categories: { type: "text" },
            description: { type: "text" },
          },
        },
      });
    }

    const operations = products.flatMap((p) => [
      { index: { _index: "dcart_products", _id: p._id } },
      {
        id: p._id,
        title: p.title,
        brand: p.brand,
        categories: p.category ? p.category.map((c) => c.name).join(" ") : "",
        description: p.description,
      },
    ]);

    if (operations.length > 0) {
      await esClient.bulk({ refresh: true, operations });
    }
  } catch (err) {
    console.warn("Elasticsearch sync failed:", err);
  }
}

export async function searchProducts(query: string): Promise<ProductData[]> {
  const products = await getProductsData();
  if (!query || !query.trim()) {
    return products;
  }

  const trimmedQuery = query.trim();

  if (esClient) {
    try {
      await syncProductsToElasticsearch(products);

      const response = await esClient.search({
        index: "dcart_products",
        query: {
          bool: {
            should: [
              {
                multi_match: {
                  query: trimmedQuery,
                  fields: ["title^5", "brand^2", "categories^2", "description"],
                  fuzziness: "AUTO",
                  operator: "or",
                },
              },
              {
                multi_match: {
                  query: trimmedQuery,
                  fields: ["title^5", "brand^2", "categories^2", "description"],
                  type: "bool_prefix",
                },
              },
            ],
          },
        },
      });

      const hits = response.hits.hits;
      const matchedProducts = hits
        .map((hit) => {
          const id = hit._id;
          return products.find((p) => p._id === id);
        })
        .filter((p): p is ProductData => !!p);

      return matchedProducts;
    } catch (err) {
      console.warn("Elasticsearch query failed, falling back to MiniSearch:", err);
    }
  }

  // minisearch fallback / local mode
  const miniSearch = new MiniSearch<ProductData & { categories: string }>({
    fields: ["title", "brand", "categories", "description"],
    idField: "_id",
  });

  const documents = products.map((p) => ({
    ...p,
    categories: p.category ? p.category.map((c) => c.name).join(" ") : "",
  }));

  miniSearch.addAll(documents);

  const results = miniSearch.search(trimmedQuery, {
    boost: { title: 5, brand: 2, categories: 2 },
    fuzzy: (term) => (term.length > 5 ? 2 : term.length > 2 ? 1 : 0),
    prefix: true,
  });

  const matchedProducts = results
    .map((result) => {
      return products.find((p) => p._id === result.id);
    })
    .filter((p): p is ProductData => !!p);

  return matchedProducts;
}
