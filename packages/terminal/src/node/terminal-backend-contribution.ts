// *****************************************************************************
// Copyright (C) 2017 TypeFox and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
// *****************************************************************************

import { injectable, inject, named } from '@theia/core/shared/inversify';
import { ILogger, RequestHandler } from '@theia/core/lib/common';
import { TerminalProcess, ProcessManager } from '@theia/process/lib/node';
import { terminalsPath } from '../common/terminal-protocol';
import { MessagingService } from '@theia/core/lib/node/messaging/messaging-service';
import { RpcProtocol } from '@theia/core/';

@injectable()
export class TerminalBackendContribution implements MessagingService.Contribution {

    @inject(ProcessManager)
    protected readonly processManager: ProcessManager;

    @inject(ILogger) @named('terminal')
    protected readonly logger: ILogger;

    configure(service: MessagingService): void {
        service.wsChannel(`${terminalsPath}/:id`, (params: { id: string }, channel) => {
            const id = parseInt(params.id, 10);
            const termProcess = this.processManager.get(id);
            if (termProcess instanceof TerminalProcess) {
                const output = termProcess.createOutputStream();
                // Create a RPC connection to the terminal process
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const requestHandler: RequestHandler = async (method: string, args: any[]) => {
                    if (method === 'write' && args[0]) {
                        termProcess.write(args[0]);
                    } else {
                        this.logger.warn('Terminal process received a request with an unsupported method or argument', { method, args });
                    }
                };

                const rpc = new RpcProtocol(channel, requestHandler);
                output.on('data', data => {
                    rpc.sendNotification('onData', [data]);
                });
                channel.onClose(() => output.dispose());
            }
        });
    }
}
