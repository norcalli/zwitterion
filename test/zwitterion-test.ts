declare var jsverify: any;
declare var fs: any;

const PAGE_LOADED = 'PAGE_LOADED';
const GET_RESULT = 'GET_RESULT';
const RESULT = 'RESULT';

import {
    arbPort,
    loadZwitterion,
    getPromisePieces,
    arbScriptElementsInfo,
    wait
} from './test-utilities';

class ZwitterionTest extends HTMLElement {
    prepareTests(test: any) {
        test('test loading an arbitrary index html file', [jsverify.number, arbPort, arbScriptElementsInfo], async (arbNumber: number, arbPort: number, arbScriptElementsInfo: any) => {
            console.log(arbScriptElementsInfo);

            for (let i=0; i < arbScriptElementsInfo.length; i++) {
                const arbScriptElementInfo = arbScriptElementsInfo[i];
                await fs.outputFile(arbScriptElementInfo.path, arbScriptElementInfo.contents);
            }

            const html = `
                <!DOCTYPE html>

                <html>
                    <head>
                        <script>
                            window.addEventListener('load', (e) => {
                                window.opener.postMessage({
                                    type: '${PAGE_LOADED}'
                                });
                            });

                            window.addEventListener('message', (e) => {
                                if (e.data === '${GET_RESULT}') {
                                    window.opener.postMessage({
                                        type: '${RESULT}',
                                        body: document.body.innerText,
                                        zwitterionTest: window.ZWITTERION_TEST
                                    });
                                }
                            });
                        </script>

                        ${arbScriptElementsInfo.map((arbScriptElementInfo: any) => {
                            return arbScriptElementInfo.element;
                        }).join('\n')}
                    </head>

                    <body>${arbNumber}</body>
                </html>
            `;
            await fs.writeFile('./index.html', html);

            const zwitterionProcess = await loadZwitterion(arbPort);
            const {thePromise, theResolve} = getPromisePieces();
            window.addEventListener('message', async (e) => {
                if (e.data.type === PAGE_LOADED) {
                    // await wait(5000);
                    testWindow.postMessage(GET_RESULT, `http://localhost:${arbPort}`);
                }

                if (e.data.type === RESULT) {
                    //TODO we really need to remove this event listener
                    const bodyHasCorrectContent = +e.data.body === arbNumber;
                    const allScriptsExecuted = (e.data.zwitterionTest === undefined && arbScriptElementsInfo.length === 0) ||
                                                e.data.zwitterionTest && arbScriptElementsInfo.filter((arbScriptElementInfo: any) => {
                                                                                return !e.data.zwitterionTest[arbScriptElementInfo.path];
                                                                            }).length === 0;

                    if (
                        bodyHasCorrectContent &&
                        allScriptsExecuted
                    ) {
                        theResolve(true);
                    }
                    else {
                        theResolve(false);
                    }
                }
            });

            const testWindow = window.open(`http://localhost:${arbPort}`, '_blank');

            const result = await thePromise;

            zwitterionProcess.kill('SIGINT');
            await fs.unlink('./index.html');
            for (let i=0; i < arbScriptElementsInfo.length; i++) {
                const arbScriptElementInfo = arbScriptElementsInfo[i];
                await fs.remove(arbScriptElementInfo.topLevelDirectory || `./${arbScriptElementInfo.fileNameWithExtension}`);
            }

            return result;
        });
    }
}

window.customElements.define('zwitterion-test', ZwitterionTest);