import { fromIni } from "@aws-sdk/credential-providers";
import { REGION } from "./constants";

type ClientConstructor<T> = new (config: { region: string; credentials: ReturnType<typeof fromIni> }) => T;

export function createClient<T>(Client: ClientConstructor<T>, profile: string, region = REGION): T {
  return new Client({ region, credentials: fromIni({ profile }) });
}
