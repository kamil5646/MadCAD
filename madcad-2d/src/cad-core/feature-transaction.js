export function executeFeatureTransaction(feature, currentBodyMap, currentBodyOrder, executor) {
  const nextBodyMap = new Map([...currentBodyMap].map(([id, body]) => [id, { ...body }]));
  const nextBodyOrder = [...currentBodyOrder];
  try {
    const result = executor(feature, nextBodyMap, nextBodyOrder);
    return {
      committed: true,
      bodyMap: nextBodyMap,
      bodyOrder: nextBodyOrder,
      result,
      error: null,
    };
  } catch (error) {
    return {
      committed: false,
      bodyMap: currentBodyMap,
      bodyOrder: currentBodyOrder,
      result: null,
      error,
    };
  }
}
