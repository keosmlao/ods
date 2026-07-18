import { InstallationCloseQueue, type CloseQueueProps } from "../close/page";

export const dynamic = "force-dynamic";

export default function FeedbackQueuePage(props: CloseQueueProps) {
  return <InstallationCloseQueue {...props} queue="feedback" />;
}
