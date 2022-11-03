import { expect } from 'chai';
import { BigNumber } from 'ethers'
import { PolywrapClient } from '@polywrap/client-js'

describe('decodePoly', () => {

  const wrapperUri = "ipfs/Qmch6aEaZPrp32Uz9DskeQeREmGfnPi1UD5WVU5A8gCHjt";

  const Erc20Wrapper = (
    client: PolywrapClient,
    uri: string = wrapperUri
  ) => ({
    transfer: (recipient: string, amount: string) =>
      client.invoke<string>({
        uri,
        method: "transfer",
        args: { recipient, amount }
      }),
  });

  interface DecodeTxResult {
    function: string;
    args: string[];
  }

  const PolyTxDecoder = (
    client: PolywrapClient,
    uris: string[]
  ) => ({
    decodeTx: (data: string) => {
      return new Promise<{
        uri: string;
        value: DecodeTxResult;
      } | undefined>((resolve) => {
        let cnt = uris.length;

        for (const uri of uris) {
          client.invoke<DecodeTxResult>({
            uri,
            method: "decodeTx",
            args: { data }
          }).then((res) => {
            if (res.ok) {
              resolve({
                uri,
                value: res.value
              });
            }
            if (--cnt <= 0) {
              resolve(undefined);
            }
          })
        }
      });
    }
  });

  it('decode wrapper', async () => {
    const client = new PolywrapClient()
    const wrapper = Erc20Wrapper(client)
    const agg = PolyTxDecoder(client, ["ens/decoder-1.eth", "ens/decoder-2.eth", wrapperUri]);

    const transferData1Args = [
      '0xfF6D102f7A5b52B6A2b654a048b0bA650bE90c59'.toLowerCase(),
      BigNumber.from(10).pow(18).toString(),
    ]
    const transferData2Args = [
      '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'.toLowerCase(),
      BigNumber.from(1).pow(18).toString(),
    ]

    const transfer1 = await wrapper.transfer(
      transferData1Args[0], transferData1Args[1]
    );
    const transfer2 = await wrapper.transfer(
      transferData2Args[0], transferData2Args[1]
    );

    if (!transfer1.ok) throw Error(`Failed to encode transfer1 data: ${transfer1.error}`)
    if (!transfer2.ok) throw Error(`Failed to encode transfer2 data: ${transfer2.error}`)

    console.log("Encoding successfuly!");
    console.log(transfer1.value);
    console.log(transfer2.value);

    // decode the individual meta transaction data
    const decodedTransferData1 = await agg.decodeTx(
      transfer1.value
    );
    const decodedTransferData2 = await agg.decodeTx(
      transfer2.value
    );

    if (!decodedTransferData1) throw Error(`Failed to decode transfer1 data`)
    if (!decodedTransferData2) throw Error(`Failed to decode transfer1 data`)

    console.log("Decoding successfuly!");
    console.log(decodedTransferData1);
    console.log(decodedTransferData2);

    expect(decodedTransferData1.value.function).to.equal(
      'function transfer(address,uint256)'
    )
    expect(decodedTransferData1.value.args).to.deep.equal([
      transferData1Args[0],
      transferData1Args[1],
    ])
    expect(decodedTransferData2.value.function).to.equal(
      'function transfer(address,uint256)'
    )
    expect(decodedTransferData2.value.args).to.deep.equal([
      transferData2Args[0],
      transferData2Args[1],
    ])
  });
});
