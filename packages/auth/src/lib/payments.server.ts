import { Polar } from "@polar-sh/sdk";
import { env, getRequiredPolarEnv } from "../../../env/src/env.server";

export const polarClient = env.ENABLE_POLAR
  ? (() => {
      const polarEnv = getRequiredPolarEnv();

      return new Polar({
        accessToken: polarEnv.POLAR_ACCESS_TOKEN,
        server: polarEnv.POLAR_MODE,
      });
    })()
  : (undefined as unknown as Polar);
