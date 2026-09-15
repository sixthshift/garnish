import { Disclosure } from "../../../../components/ui/Disclosure";
import type { TimelineEvent } from "../../../../domain/recipe";
import { TimelineRow } from "./TimelineRow";

export type TimelineListProps = { events: readonly TimelineEvent[] };

/**
 * The logged cooks, newest first, as a closed `Disclosure` titled "History"
 * with the count in its hint ("4 cooks", "1 cook") — history nobody reads
 * while cooking, so it opens folded. Renders nothing
 * with no events: there is no "Not made yet" standing in for an empty list
 * any more, since the disclosure itself would have nothing to hold.
 */
export function TimelineList({ events }: TimelineListProps) {
  if (events.length === 0) return null;
  const hint = events.length === 1 ? "1 cook" : `${events.length} cooks`;

  return (
    <Disclosure title="History" hint={hint}>
      <ul className="flex flex-col divide-y divide-border-subtle" data-testid="timeline">
        {events.map((event) => (
          <TimelineRow key={event.id} event={event} />
        ))}
      </ul>
    </Disclosure>
  );
}
