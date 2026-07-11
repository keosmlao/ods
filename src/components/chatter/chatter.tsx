import { getActivities, getFollowers, getMessages } from "@/app/actions/chatter";
import { ChatterPanel } from "@/components/chatter/chatter-panel";
import { getSession } from "@/lib/auth";
import { getErpTechnicians } from "@/lib/erp-master";

/**
 * ວາງ <Chatter model="tb_product" resId={code} /> ໄວ້ທ້າຍໜ້າເອກະສານໃດກໍ່ໄດ້.
 * ດຶງຂໍ້ມູນຢູ່ server ແລ້ວສົ່ງໃຫ້ panel (client) ໄປສະແດງ.
 */
export async function Chatter({ model, resId }: { model: string; resId: string }) {
  const session = await getSession();
  if (!session) return null;

  const [messages, activities, followers, technicians] = await Promise.all([
    getMessages(model, resId),
    getActivities(model, resId),
    getFollowers(model, resId),
    getErpTechnicians(),
  ]);

  // ຜູ້ຮັບຜິດຊອບທີ່ເລືອກໄດ້ = ຊ່າງບໍລິການ + ຄົນທີ່ຕິດຕາມເອກະສານນີ້ຢູ່ + ຕົວເອງ
  const people = new Map<string, string>();
  technicians.forEach((tech) => people.set(tech.code, tech.name_1));
  followers.forEach((name) => people.has(name) || people.set(name, name));
  if (!people.has(session.username)) people.set(session.username, session.username);

  return (
    <ChatterPanel
      model={model}
      resId={resId}
      messages={messages}
      activities={activities}
      followers={followers}
      people={[...people].map(([value, label]) => ({ value, label }))}
      me={session.username}
    />
  );
}
