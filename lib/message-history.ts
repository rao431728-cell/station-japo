import type { Message } from "@/types";
/** Unknown dates are never replaced by import timestamps. Preserve the reviewed order. */
export function orderMessages(messages: Message[], newestFirst = false) {
  const result = [...messages];
  if (result.every(m => m.date && !m.dateUnknown)) result.sort((a, b) => a.date.localeCompare(b.date));
  return newestFirst ? result.reverse() : result;
}
