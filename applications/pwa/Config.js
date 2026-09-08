/**
 * ROBrowser Configuration - Default Settings
 *
 * This file contains default configuration values.
 * To override settings without modifying this file, create Config.local.js
 * with your custom values in window.ROConfigLocal.
 *
 * Example Config.local.js:
 *   window.ROConfigLocal = {
 *       servers: [{ display: 'My Server', address: '192.168.1.1', ... }],
 *       skipIntro: true
 *   };
 */

const hostname = location.hostname;

window.ROConfigBase = {
	type: 'FRAME',
	application: 'ONLINE',
	development: true,
	remoteClient: `http://${hostname}:3338`,
	servers: [
		{
			display: 'roBrowser Demo Server',
			desc: 'demo server',
			address: '127.0.0.1',
			port: 6900,
			version: 25,
			langtype: 12,
			packetver: 20170614,
			renewal: false,
			worldMapSettings: { episode: 12 },
			packetKeys: false,
			socketProxy: `ws://${hostname}:3338/ws`,
			adminList: [2000000]
		}
		// ADD PUBLIC TEST SERVERS HERE WITH _M _F REGISTRATION
	],
	packetDump: false,
	skipServerList: true,
	skipIntro: false,
	aura: {},
	autoLogin: [],
	BGMFileExtension: ['mp3'],
	calculateHash: false,
	CameraMaxZoomOut: 5,
	charBlockSize: 0,
	clientHash: null,
	clientVersionMode: 'PacketVer',
	disableConsole: false,
	enableAchievements: false,
	enableBank: false,
	enableCashShop: false,
	enableCheckAttendance: false,
	enableDmgSuffix: false,
	enableHomunAutoFeed: false,
	enableMapName: false,
	FirstPersonCamera: false,
	grfList: null,
	hashFiles: [],
	loadLua: false,
	onReady: null,
	plugins: {},
	registrationweb: '',
	saveFiles: true,
	ThirdPersonCamera: false,
	transitionDuration: 500,
	useSystemFolderFont: false
};
