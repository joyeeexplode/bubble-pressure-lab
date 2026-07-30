const PRESCRIPTIONS = Object.freeze({
  花园自然: ["让焦虑慢慢散成种子", "把紧绷交给风和花瓣"],
  冰晶舒裂: ["把僵住的念头轻轻敲开", "让压力裂成清亮的碎光"],
  软弹治愈: ["允许自己软一点，也能继续向前", "把今天的棱角揉成柔软回弹"],
  "壳片 ASMR": ["把硬撑太久的外壳放下来", "让脑子里的杂音一片片落地"],
  轻快连破: ["把脑子里的噪音捏掉", "让多余的压力噗噗漏气"],
});

const ITEM_LABELS = Object.freeze({
  duck: "洗澡小鸭",
  cyberChicken: "赛博小鸡",
  frog: "软糖青蛙",
  dandelion: "蒲公英",
  walnut_pressure_shell: "核桃压力壳",
  cracked_ice_cube: "裂纹冰块",
  gummy_cube: "软糖方块",
  softCloud: "柔软云团",
});

export function createRoundResult({ poppedCount, remainingType, themeLabel, random = Math.random }) {
  const options = PRESCRIPTIONS[themeLabel] ?? ["把这一分钟还给平静", "给脑子留一点安静的空白"];
  const prescription = options[Math.floor(random() * options.length)];
  const remainingLabel = ITEM_LABELS[remainingType] ?? "还没碎掉的小小压力块";
  const headline = `你释放了 ${poppedCount} 份压力`;
  const detail = `最后留下的是${remainingLabel}。${prescription}。`;
  return {
    headline,
    detail,
    shareText: `${headline}。${detail}`,
  };
}
