import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getTxnOpts} from './helpers/getTxnOpts';
import {getConfigForChain} from '../../config';
import {DeployConfig} from './types';
import {getWeth} from '../getDepenencies';
import {Contract} from 'ethers';

export class DeployStep {
	id: string;
	deploy: any;
	tags: string[] | undefined;
	config: DeployConfig | undefined;
	dependencies: string[] | undefined;
	dao: string | undefined;
	deployer: string | undefined;
	treasury: string | undefined;
	baseAssetWrapped: string;
	network: any;
	weth: any;
	deployments: any;
	baseAssetPrice: number;
	read: (name: string, funcName: string, args?: any[]) => Promise<string>;
	getContract: any;
	execute: any;
	executeFrom: any;
	get: any;
	runOnce: boolean;
	chainlinkEthUsd: string;
	admin: string;
	vestManager: string;
	starfleet: string;

	constructor(options: {id: string; tags?: string[]; dependencies?: string[]; runOnce?: boolean}) {
		this.id = options.id;
		this.tags = options.tags || [];
		this.tags?.push(this.id);
		this.dependencies = options.dependencies || [];
		this.runOnce = options.runOnce || false;
		if (this.id !== 'weth') {
			this.dependencies.push('weth');
		}
	}

	setFunction(func: Function) {
		let func2: DeployFunction = async (hre: HardhatRuntimeEnvironment): Promise<boolean | void> => {
			console.log(` `);
			console.log(`--- ${this.id} ---`);

			const {deployments, getNamedAccounts, network} = hre;
			const {deploy, execute, read, get} = deployments;
			const {deployer, dao, treasury, admin, vestManager, starfleet} = await getNamedAccounts();
			const txnOpts = await getTxnOpts(hre);
			const {config} = getConfigForChain(await hre.getChainId());
			const {baseAssetWrapped} = getConfigForChain(await hre.getChainId());
			this.baseAssetWrapped = baseAssetWrapped;
			this.baseAssetPrice = baseAssetWrapped === 'WBNB' ? 300 : 2100;

			if (this.id !== 'weth') {
				this.weth = (await getWeth(hre)).weth;
				this.chainlinkEthUsd = (await getWeth(hre)).chainlinkEthUsd;
			}

			this.deployments = deployments;
			this.config = config;
			this.deployer = deployer;
			this.dao = dao;
			this.admin = admin;
			this.vestManager = vestManager;
			this.starfleet = starfleet;
			this.treasury = treasury;
			this.network = network;
			this.deploy = async function (name: string, opts: any) {
				return await deploy(name, {
					...txnOpts,
					...opts,
				});
			};
			this.execute = async function (name: string, funcName: string, ...args: any[]) {
				return await execute(name, txnOpts, funcName, ...args);
			};
			this.executeFrom = async function (name: string, from: string, funcName: string, ...args: any[]) {
				let opts = txnOpts;
				opts.from = from;
				return await execute(name, opts, funcName, ...args);
			};
			this.read = async function (name: string, funcName: string, ...args: any[]) {
				return await read(name, funcName, ...args);
			};
			this.get = async function (name: string) {
				return await get(name);
			};
			this.getContract = async function (name: string): Promise<Contract> {
				let deployment = await get(name);
				return await hre.ethers.getContractAt(name, deployment.address);
			};

			await func();

			if (this.runOnce) {
				return true;
			}
		};

		func2.id = this.id;
		func2.tags = this.tags;
		func2.dependencies = this.dependencies;

		return func2;
	}
}
