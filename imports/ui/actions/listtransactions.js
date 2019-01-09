import { Promise } from 'meteor/promise';
import { devlog } from './dev';
import { isKomodoCoin } from './../lib/agama-wallet-lib/build/coin-helpers';
import parseTransactionAddresses from './../lib/agama-wallet-lib/build/transaction-type';
import electrumJSNetworks from './../lib/agama-wallet-lib/build/bitcoinjs-networks';
import electrumJSTxDecoder from './../lib/agama-wallet-lib/build/transaction-decoder';

const CONNECTION_ERROR_OR_INCOMPLETE_DATA = 'connection error or incomplete data';

const listtransactions = (proxyServer, electrumServer, address, network, full, cache, numberOfTransactions) => {

  console.log("list transactions: ", electrumServer)
  // server = electrumServer.serverList[0].split(':');
  // electrumServer.ip

  return new Promise((resolve, reject) => {
    // get current height
    // HTTP.call('GET', `http://${proxyServer.ip}:${proxyServer.port}/api/getcurrentblock`, {
    HTTP.call('GET', `https://${proxyServer.ip}/api/getcurrentblock`, {
      params: {
        port: electrumServer.port,
        ip: electrumServer.ip,
        proto: electrumServer.proto,
      },
    }, (error, result) => {
      result = JSON.parse(result.content);

      console.log("result getcurrentblock >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");

      if (result.msg === 'error') {
        resolve('error');
      } else {
        const currentHeight = result.result;

        devlog('currentHeight =>');
        devlog(currentHeight);

        console.log("before listtransactions >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");

        // HTTP.call('GET', `http://${proxyServer.ip}:${proxyServer.port}/api/listtransactions`, {
        HTTP.call('GET', `https://${proxyServer.ip}/api/listtransactions`, {
          params: {
            port: electrumServer.port,
            ip: electrumServer.ip,
            proto: electrumServer.proto,
            address,
            raw: true,
            maxlength: numberOfTransactions,
          },
        }, (error, result) => {

          if(!error && result && result.content) {
            try {
              result = JSON.parse(result.content);
            } catch(e) {
              console.log("---------------------- error fetching coin utxos", e);
            }
          }

          if (!error && result.msg !== 'error') {
            let _transactions = [];

            // parse listtransactions
            const json = result.result;

            if (json &&
                json.length) {
              let _rawtx = [];

              Promise.all(json.map((transaction, index) => {
                return new Promise((resolve, reject) => {
                  cache.getBlockheader(
                    transaction.height,
                    network,
                    {
                      // url: `http://${proxyServer.ip}:${proxyServer.port}/api/getblockinfo`,
                      url: `https://${proxyServer.ip}/api/getblockinfo`,
                      params: {
                        port: electrumServer.port,
                        ip: electrumServer.ip,
                        proto: electrumServer.proto,
                        height: transaction.height,
                      },
                    }
                  )
                  .then((result) => {
                    devlog('getblock =>');
                    devlog(result);

                    result = JSON.parse(result.content);

                    if (result.msg !== 'error') {
                      const blockInfo = result.result;

                      devlog('electrum gettransaction ==>');
                      devlog(`${index} | ${(transaction.raw.length - 1)}`);
                      devlog(transaction.raw);

                      // decode tx
                      const _network = electrumJSNetworks[isKomodoCoin(network) || network === 'kmd' ? 'kmd' : network];
                      const decodedTx = electrumJSTxDecoder(transaction.raw, _network);

                      let txInputs = [];

                      devlog('decodedtx =>');
                      devlog(decodedTx.outputs);

                      if (decodedTx &&
                          decodedTx.inputs) {
                        Promise.all(decodedTx.inputs.map((_decodedInput, index) => {
                          return new Promise((_resolve, _reject) => {
                            if (_decodedInput.txid !== '0000000000000000000000000000000000000000000000000000000000000000') {
                              cache.getTransaction(
                                _decodedInput.txid,
                                network,
                                {
                                  // url: `http://${proxyServer.ip}:${proxyServer.port}/api/gettransaction`,
                                  url: `https://${proxyServer.ip}/api/gettransaction`,
                                  params: {
                                    port: electrumServer.port,
                                    ip: electrumServer.ip,
                                    proto: electrumServer.proto,
                                    txid: _decodedInput.txid,
                                  },
                                }
                              )
                              .then((result) => {
                                devlog('gettransaction =>');
                                devlog(result);

                                result = JSON.parse(result.content);

                                if (result.msg !== 'error') {
                                  const decodedVinVout = electrumJSTxDecoder(result.result, _network);

                                  devlog('electrum raw input tx ==>');

                                  if (decodedVinVout) {
                                    devlog(decodedVinVout.outputs[_decodedInput.n], true);
                                    txInputs.push(decodedVinVout.outputs[_decodedInput.n]);
                                    _resolve(true);
                                  } else {
                                    _resolve(true);
                                  }
                                }
                              });
                            } else {
                              _resolve(true);
                            }
                          });
                        }))
                        .then(promiseResult => {
                          const _parsedTx = {
                            network: decodedTx.network,
                            format: decodedTx.format,
                            inputs: txInputs,
                            outputs: decodedTx.outputs,
                            height: transaction.height,
                            timestamp: Number(transaction.height) === 0 ? Math.floor(Date.now() / 1000) : blockInfo.timestamp,
                            confirmations: Number(transaction.height) === 0 ? 0 : (currentHeight - transaction.height + 1),
                          };

                          const formattedTx = parseTransactionAddresses(_parsedTx, address, network === 'kmd' ? true : false);

                          if (formattedTx.type) {
                            formattedTx.height = transaction.height;
                            formattedTx.blocktime = blockInfo.timestamp;
                            formattedTx.timereceived = blockInfo.timereceived;
                            formattedTx.hex = transaction.raw;
                            formattedTx.inputs = decodedTx.inputs;
                            formattedTx.outputs = decodedTx.outputs;
                            formattedTx.locktime = decodedTx.format.locktime;
                            _rawtx.push(formattedTx);
                          } else {
                            formattedTx[0].height = transaction.height;
                            formattedTx[0].blocktime = blockInfo.timestamp;
                            formattedTx[0].timereceived = blockInfo.timereceived;
                            formattedTx[0].hex = transaction.raw;
                            formattedTx[0].inputs = decodedTx.inputs;
                            formattedTx[0].outputs = decodedTx.outputs;
                            formattedTx[0].locktime = decodedTx.format.locktime;
                            formattedTx[1].height = transaction.height;
                            formattedTx[1].blocktime = blockInfo.timestamp;
                            formattedTx[1].timereceived = blockInfo.timereceived;
                            formattedTx[1].hex = transaction.raw;
                            formattedTx[1].inputs = decodedTx.inputs;
                            formattedTx[1].outputs = decodedTx.outputs;
                            formattedTx[1].locktime = decodedTx.format.locktime;
                            _rawtx.push(formattedTx[0]);
                            _rawtx.push(formattedTx[1]);
                          }
                          resolve(true);
                        });
                      } else {
                        const _parsedTx = {
                          network: decodedTx.network,
                          format: 'cant parse',
                          inputs: 'cant parse',
                          outputs: 'cant parse',
                          height: transaction.height,
                          timestamp: Number(transaction.height) === 0 ? Math.floor(Date.now() / 1000) : blockInfo.timestamp,
                          confirmations: Number(transaction.height) === 0 ? 0 : currentHeight - transaction.height,
                        };

                        const formattedTx = parseTransactionAddresses(_parsedTx, address, network === 'kmd' ? true : false);
                        _rawtx.push(formattedTx);
                        resolve(true);
                      }
                    } else {
                      const _parsedTx = {
                        network: 'cant parse',
                        format: 'cant parse',
                        inputs: 'cant parse',
                        outputs: 'cant parse',
                        height: transaction.height,
                        timestamp: 'cant get block info',
                        confirmations: Number(transaction.height) === 0 ? 0 : currentHeight - transaction.height,
                      };
                      const formattedTx = parseTransactionAddresses(_parsedTx, address, network === 'kmd' ? true : false);
                      _rawtx.push(formattedTx);
                      resolve(true);
                    }
                  });
                });
              }))
              .then(promiseResult => {
                resolve(_rawtx);
              });
            } else {
              // empty history
              resolve([]);
            }
          } else {
            resolve('error');
          }

          devlog(result);
        });
      }
    });
  });
};

export default listtransactions;