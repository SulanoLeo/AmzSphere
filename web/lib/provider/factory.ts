import { MockProvider } from "./mock";
import { LiveProviderError, ProductProvider, DataSource } from "./interface";

let providerCache: ProductProvider | null = null;
let resolvedSource: DataSource | null = null;

export function resolveDataSource(): DataSource {
  if (resolvedSource) return resolvedSource;
  const raw = process.env.DATA_SOURCE;
  if (raw === "live") {
    resolvedSource = "live";
  } else {
    resolvedSource = "mock";
  }
  return resolvedSource;
}

export function createProductProvider(): ProductProvider {
  if (providerCache) return providerCache;
  const source = resolveDataSource();
  if (source === "live") {
    throw new LiveProviderError();
  }
  providerCache = new MockProvider();
  return providerCache;
}

export function getProductProvider(): ProductProvider {
  return createProductProvider();
}
