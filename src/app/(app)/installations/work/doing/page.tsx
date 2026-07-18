import { InstallationWorkQueue, type WorkQueueProps } from "../page";

export const dynamic = "force-dynamic";

export default function DoingInstallPage(props: WorkQueueProps) {
  return <InstallationWorkQueue {...props} queue="doing" />;
}
