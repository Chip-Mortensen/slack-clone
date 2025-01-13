type RequestKey = string;
type RequestPromise<T> = Promise<T>;

class RequestDeduplicator {
  private pending: Map<RequestKey, RequestPromise<any>> = new Map();

  async deduplicate<T>(
    key: RequestKey,
    request: () => Promise<T>
  ): Promise<T> {
    if (this.pending.has(key)) {
      return this.pending.get(key)!;
    }

    const promise = request().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise;
  }
}

export const requestDeduplicator = new RequestDeduplicator(); 