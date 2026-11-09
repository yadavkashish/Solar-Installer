export function forwardAsyncErrors(handler: any): any {
  return (...args: any[]) => {
    const next = args[handler.length === 4 ? 3 : 2];
    try {
      const result = handler(...args);
      if (
        result &&
        (typeof result === "object" || typeof result === "function") &&
        typeof result.then === "function"
      )
        return Promise.resolve(result).catch(next);
      return result;
    } catch (error) {
      return next(error);
    }
  };
}
