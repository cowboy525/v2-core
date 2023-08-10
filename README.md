# Local deployment

cp `.env.example` to `.env` and fill the next enviroment variables

Run deployment:

Terminal 1

```shell
npx hardhat node --no-deploy
```

Terminal 2

```shell
yarn deploy localhost --reset
cp /deployments/localhost/deployData.json <frontend dir>/src/ui-config/addresses/local.json
```

# Tests

(after .env copied)
```shell
yarn test
```

## Running test in forked mode:

Make sure the `localhost` network in your `hardhat.config` file has forking enabled.

Example configuration:
```
localhost: {
    url: node_url('localhost'),
    autoImpersonate: true,
    timeout: 10000000000000,
    forking: {
        url: node_url('arbitrum'),
        blockNumber: 110000000,
    },
    chainId: 31337,
    tags: ['mocks', 'testing', 'oracle_v2', 'post_assets', 'fork'],
},
```
Ensure that the `fork` tag is added.

Run your node with:
```shell
`npx hardhat node --no-deploy`
```

In a second terminal run the tests with:
```shell
yarn test
```
