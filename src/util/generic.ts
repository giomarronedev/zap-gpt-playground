export async function delay(time: number): Promise<unknown> {
  return await new Promise((resolve) => setTimeout(resolve, time));
}
