import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("IMPHNENMemberCard", (m) => {
  const collection = m.contract("IMPHNENMemberCard");
  return { collection };
});
