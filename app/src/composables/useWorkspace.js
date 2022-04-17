import { Program, Provider } from '@project-serum/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { useAnchorWallet } from 'solana-wallets-vue';
import { computed } from 'vue';
import idl from '@/idl/solana_twitter.json';

const clusterUrl = process.env.VUE_APP_CLUSTER_URL;
const programID = new PublicKey(idl.metadata.address);
let workspace = null;
const preflightCommitment = 'processed';
const commitment = 'processed';
export const useWorkspace = () => workspace;
export const initWorkspace = () => {
  const wallet = useAnchorWallet();
  const connection = new Connection(clusterUrl, commitment);
  const provider = computed(
    () =>
      new Provider(connection, wallet.value, {
        preflightCommitment,
        commitment,
      })
  );
  const program = computed(() => new Program(idl, programID, provider.value));

  workspace = {
    wallet,
    connection,
    provider,
    program,
  };

  return workspace;
};
