import { parseAwsConfig, type DynamicAccount } from "./aws-config-parser";

export { REGION } from "./constants";
export type Account = DynamicAccount;

export async function getAccounts(): Promise<DynamicAccount[]> {
  return parseAwsConfig();
}
