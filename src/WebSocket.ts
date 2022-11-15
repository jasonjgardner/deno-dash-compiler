export class WebSocketServer {
	protected socket?: WebSocket;

	/**
	 * Whether the WebSocket is open
	 */
	get isStarted() {
		return (this.socket?.readyState === WebSocket.OPEN);
	}

	/**
	 * Open a WebSocket on localhost
	 * @param port Network port to open the socket on
	 */
	async start(port: number) {
		await this.setLoopbackExemption();

		const listener = Deno.listen({ port });
		const connection = await listener.accept();
		const httpConnection = Deno.serveHttp(connection);

		for await (const event of httpConnection) {
			const { socket, response } = Deno.upgradeWebSocket(event.request);
			this.socket = socket;
			await event.respondWith(response);
			console.info('WebSocket connection established!');
			const intervalId = this.keepAlive();
			this.socket.onclose = () => {
				clearInterval(intervalId);
				console.info('WebSocket connection closed!');
			};
		}
	}

	/**
	 * Runs a console command inside of Minecraft, if the WebSocket is still open
	 * @param command The command to be run (without the slash)
	 * @returns The response from Minecraft after requesting the command to be run
	 */
	runCommand(command: string) {
		return new Promise<{ message: string; status: number }>(
			(resolve, reject) => {
				if (this.socket === undefined || !this.isStarted) {
					reject({
						message: 'WebSocket is not open',
						status: 500,
					});
				}

				const requestId = crypto.randomUUID();
				const data = JSON.stringify({
					header: {
						version: 1,
						requestId,
						messageType: 'commandRequest',
						messagePurpose: 'commandRequest',
					},
					body: {
						commandLine: command,
					},
				});

				this.socket?.send(data);
				this.socket?.addEventListener('message', (event) => {
					const res = JSON.parse(event.data.toString());
					if (res.header.requestId !== requestId) {
						reject({
							message: 'Request ID does not match',
							status: 500,
						});
					}
					resolve({
						message: res.body.statusMessage,
						status: res.body.statusCode,
					});
				});
			},
		);
	}

	/**
	 * Runs console commands to set both Minecraft retail and preview clients to be exempt from UWP network loopback restrictions so that the clients can connect to a local WebSocket
	 */
	async setLoopbackExemption() {
		// Minecraft Retail Build
		const retail = Deno.run({
			cmd: [
				'CheckNetIsolation.exe',
				'LoopbackExempt',
				'-a',
				'-n=microsoft.minecraftuwp_8wekyb3d8bbwe',
			],
			stdout: 'null',
		});
		const retailStat = await retail.status();
		if (retailStat.code !== 0) {
			console.log(
				'Unable to set network loopback exemption for Minecraft retail build.',
			);
		}
		retail.close();

		// Minecraft Preview Build
		const preview = Deno.run({
			cmd: [
				'CheckNetIsolation.exe',
				'LoopbackExempt',
				'-a',
				'-n=Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe',
			],
			stdout: 'null',
		});
		const previewStat = await preview.status();
		if (previewStat.code !== 0) {
			console.log(
				'Unable to set network loopback exemption for Minecraft preview build.',
			);
		}
		preview.close();
	}

	/**
	 * Sends empty requests to the client every 25 seconds to stop the connection from timing out
	 * @param duration The duration in milliseconds between each request
	 * @returns The interval id (use to cancel when WebSocket is closed)
	 */
	keepAlive(duration = 25000) {
		return setInterval(() => {
			this.socket?.send('');
		}, duration);
	}
}
