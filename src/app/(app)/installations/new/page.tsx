import { InstallForm } from "@/components/installation/install-form";
import { PageTitle } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";

/** ຖອດແບບຈາກ ods: /install_create + /save_install_create (install_admin.py) */
export const dynamic = "force-dynamic";

export default async function NewInstallation() {
  const [session, categories] = await Promise.all([
    getSession(),
    query<{ code: string; name_1: string }>("select code,name_1 from tb_category order by name_1"),
  ]);

  return (
    <div className="w-full space-y-5">
      <PageTitle>ເປີດງານຕິດຕັ້ງ</PageTitle>
      <InstallForm categories={categories.rows} username={session?.username ?? ""} />
    </div>
  );
}
