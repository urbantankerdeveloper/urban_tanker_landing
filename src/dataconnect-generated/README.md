# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `React README`, you can find it at [`dataconnect-generated/react/README.md`](./react/README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetUser*](#getuser)
  - [*ListUsers*](#listusers)
  - [*GetYardSale*](#getyardsale)
  - [*ListYardSales*](#listyardsales)
  - [*GetItem*](#getitem)
  - [*ListItems*](#listitems)
  - [*ListFollows*](#listfollows)
  - [*ListMessages*](#listmessages)
- [**Mutations**](#mutations)
  - [*InsertUser*](#insertuser)
  - [*UpdateUser*](#updateuser)
  - [*DeleteUser*](#deleteuser)
  - [*CreateYardSale*](#createyardsale)
  - [*UpdateYardSale*](#updateyardsale)
  - [*DeleteYardSale*](#deleteyardsale)
  - [*CreateItem*](#createitem)
  - [*UpdateItem*](#updateitem)
  - [*DeleteItem*](#deleteitem)
  - [*CreateFollow*](#createfollow)
  - [*DeleteFollow*](#deletefollow)
  - [*SendMessage*](#sendmessage)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## GetUser
You can execute the `GetUser` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getUser(options?: ExecuteQueryOptions): QueryPromise<GetUserData, undefined>;

interface GetUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetUserData, undefined>;
}
export const getUserRef: GetUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getUser(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetUserData, undefined>;

interface GetUserRef {
  ...
  (dc: DataConnect): QueryRef<GetUserData, undefined>;
}
export const getUserRef: GetUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getUserRef:
```typescript
const name = getUserRef.operationName;
console.log(name);
```

### Variables
The `GetUser` query has no variables.
### Return Type
Recall that executing the `GetUser` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetUserData {
  user?: {
    username: string;
    email: string;
    bio?: string | null;
    profilePictureUrl?: string | null;
  };
}
```
### Using `GetUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getUser } from '@dataconnect/generated';


// Call the `getUser()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getUser();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getUser(dataConnect);

console.log(data.user);

// Or, you can use the `Promise` API.
getUser().then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

### Using `GetUser`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getUserRef } from '@dataconnect/generated';


// Call the `getUserRef()` function to get a reference to the query.
const ref = getUserRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getUserRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.user);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.user);
});
```

## ListUsers
You can execute the `ListUsers` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listUsers(options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;

interface ListUsersRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListUsersData, undefined>;
}
export const listUsersRef: ListUsersRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listUsers(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;

interface ListUsersRef {
  ...
  (dc: DataConnect): QueryRef<ListUsersData, undefined>;
}
export const listUsersRef: ListUsersRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listUsersRef:
```typescript
const name = listUsersRef.operationName;
console.log(name);
```

### Variables
The `ListUsers` query has no variables.
### Return Type
Recall that executing the `ListUsers` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListUsersData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListUsersData {
  users: ({
    username: string;
    profilePictureUrl?: string | null;
  })[];
}
```
### Using `ListUsers`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listUsers } from '@dataconnect/generated';


// Call the `listUsers()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listUsers();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listUsers(dataConnect);

console.log(data.users);

// Or, you can use the `Promise` API.
listUsers().then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

### Using `ListUsers`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listUsersRef } from '@dataconnect/generated';


// Call the `listUsersRef()` function to get a reference to the query.
const ref = listUsersRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listUsersRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.users);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.users);
});
```

## GetYardSale
You can execute the `GetYardSale` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getYardSale(vars: GetYardSaleVariables, options?: ExecuteQueryOptions): QueryPromise<GetYardSaleData, GetYardSaleVariables>;

interface GetYardSaleRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetYardSaleVariables): QueryRef<GetYardSaleData, GetYardSaleVariables>;
}
export const getYardSaleRef: GetYardSaleRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getYardSale(dc: DataConnect, vars: GetYardSaleVariables, options?: ExecuteQueryOptions): QueryPromise<GetYardSaleData, GetYardSaleVariables>;

interface GetYardSaleRef {
  ...
  (dc: DataConnect, vars: GetYardSaleVariables): QueryRef<GetYardSaleData, GetYardSaleVariables>;
}
export const getYardSaleRef: GetYardSaleRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getYardSaleRef:
```typescript
const name = getYardSaleRef.operationName;
console.log(name);
```

### Variables
The `GetYardSale` query requires an argument of type `GetYardSaleVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetYardSaleVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetYardSale` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetYardSaleData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetYardSaleData {
  yardSale?: {
    title: string;
    address: string;
    startTime: TimestampString;
    endTime: TimestampString;
    description?: string | null;
    imageUrl?: string | null;
  };
}
```
### Using `GetYardSale`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getYardSale, GetYardSaleVariables } from '@dataconnect/generated';

// The `GetYardSale` query requires an argument of type `GetYardSaleVariables`:
const getYardSaleVars: GetYardSaleVariables = {
  id: ..., 
};

// Call the `getYardSale()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getYardSale(getYardSaleVars);
// Variables can be defined inline as well.
const { data } = await getYardSale({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getYardSale(dataConnect, getYardSaleVars);

console.log(data.yardSale);

// Or, you can use the `Promise` API.
getYardSale(getYardSaleVars).then((response) => {
  const data = response.data;
  console.log(data.yardSale);
});
```

### Using `GetYardSale`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getYardSaleRef, GetYardSaleVariables } from '@dataconnect/generated';

// The `GetYardSale` query requires an argument of type `GetYardSaleVariables`:
const getYardSaleVars: GetYardSaleVariables = {
  id: ..., 
};

// Call the `getYardSaleRef()` function to get a reference to the query.
const ref = getYardSaleRef(getYardSaleVars);
// Variables can be defined inline as well.
const ref = getYardSaleRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getYardSaleRef(dataConnect, getYardSaleVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.yardSale);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.yardSale);
});
```

## ListYardSales
You can execute the `ListYardSales` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listYardSales(options?: ExecuteQueryOptions): QueryPromise<ListYardSalesData, undefined>;

interface ListYardSalesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListYardSalesData, undefined>;
}
export const listYardSalesRef: ListYardSalesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listYardSales(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListYardSalesData, undefined>;

interface ListYardSalesRef {
  ...
  (dc: DataConnect): QueryRef<ListYardSalesData, undefined>;
}
export const listYardSalesRef: ListYardSalesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listYardSalesRef:
```typescript
const name = listYardSalesRef.operationName;
console.log(name);
```

### Variables
The `ListYardSales` query has no variables.
### Return Type
Recall that executing the `ListYardSales` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListYardSalesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListYardSalesData {
  yardSales: ({
    title: string;
    address: string;
    startTime: TimestampString;
    endTime: TimestampString;
  })[];
}
```
### Using `ListYardSales`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listYardSales } from '@dataconnect/generated';


// Call the `listYardSales()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listYardSales();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listYardSales(dataConnect);

console.log(data.yardSales);

// Or, you can use the `Promise` API.
listYardSales().then((response) => {
  const data = response.data;
  console.log(data.yardSales);
});
```

### Using `ListYardSales`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listYardSalesRef } from '@dataconnect/generated';


// Call the `listYardSalesRef()` function to get a reference to the query.
const ref = listYardSalesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listYardSalesRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.yardSales);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.yardSales);
});
```

## GetItem
You can execute the `GetItem` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getItem(vars: GetItemVariables, options?: ExecuteQueryOptions): QueryPromise<GetItemData, GetItemVariables>;

interface GetItemRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetItemVariables): QueryRef<GetItemData, GetItemVariables>;
}
export const getItemRef: GetItemRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getItem(dc: DataConnect, vars: GetItemVariables, options?: ExecuteQueryOptions): QueryPromise<GetItemData, GetItemVariables>;

interface GetItemRef {
  ...
  (dc: DataConnect, vars: GetItemVariables): QueryRef<GetItemData, GetItemVariables>;
}
export const getItemRef: GetItemRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getItemRef:
```typescript
const name = getItemRef.operationName;
console.log(name);
```

### Variables
The `GetItem` query requires an argument of type `GetItemVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetItemVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `GetItem` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetItemData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetItemData {
  item?: {
    title: string;
    price: number;
    description?: string | null;
    imageUrl?: string | null;
    isSold?: boolean | null;
  };
}
```
### Using `GetItem`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getItem, GetItemVariables } from '@dataconnect/generated';

// The `GetItem` query requires an argument of type `GetItemVariables`:
const getItemVars: GetItemVariables = {
  id: ..., 
};

// Call the `getItem()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getItem(getItemVars);
// Variables can be defined inline as well.
const { data } = await getItem({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getItem(dataConnect, getItemVars);

console.log(data.item);

// Or, you can use the `Promise` API.
getItem(getItemVars).then((response) => {
  const data = response.data;
  console.log(data.item);
});
```

### Using `GetItem`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getItemRef, GetItemVariables } from '@dataconnect/generated';

// The `GetItem` query requires an argument of type `GetItemVariables`:
const getItemVars: GetItemVariables = {
  id: ..., 
};

// Call the `getItemRef()` function to get a reference to the query.
const ref = getItemRef(getItemVars);
// Variables can be defined inline as well.
const ref = getItemRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getItemRef(dataConnect, getItemVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.item);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.item);
});
```

## ListItems
You can execute the `ListItems` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listItems(vars: ListItemsVariables, options?: ExecuteQueryOptions): QueryPromise<ListItemsData, ListItemsVariables>;

interface ListItemsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListItemsVariables): QueryRef<ListItemsData, ListItemsVariables>;
}
export const listItemsRef: ListItemsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listItems(dc: DataConnect, vars: ListItemsVariables, options?: ExecuteQueryOptions): QueryPromise<ListItemsData, ListItemsVariables>;

interface ListItemsRef {
  ...
  (dc: DataConnect, vars: ListItemsVariables): QueryRef<ListItemsData, ListItemsVariables>;
}
export const listItemsRef: ListItemsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listItemsRef:
```typescript
const name = listItemsRef.operationName;
console.log(name);
```

### Variables
The `ListItems` query requires an argument of type `ListItemsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ListItemsVariables {
  yardSaleId: UUIDString;
}
```
### Return Type
Recall that executing the `ListItems` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListItemsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListItemsData {
  items: ({
    title: string;
    price: number;
    isSold?: boolean | null;
  })[];
}
```
### Using `ListItems`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listItems, ListItemsVariables } from '@dataconnect/generated';

// The `ListItems` query requires an argument of type `ListItemsVariables`:
const listItemsVars: ListItemsVariables = {
  yardSaleId: ..., 
};

// Call the `listItems()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listItems(listItemsVars);
// Variables can be defined inline as well.
const { data } = await listItems({ yardSaleId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listItems(dataConnect, listItemsVars);

console.log(data.items);

// Or, you can use the `Promise` API.
listItems(listItemsVars).then((response) => {
  const data = response.data;
  console.log(data.items);
});
```

### Using `ListItems`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listItemsRef, ListItemsVariables } from '@dataconnect/generated';

// The `ListItems` query requires an argument of type `ListItemsVariables`:
const listItemsVars: ListItemsVariables = {
  yardSaleId: ..., 
};

// Call the `listItemsRef()` function to get a reference to the query.
const ref = listItemsRef(listItemsVars);
// Variables can be defined inline as well.
const ref = listItemsRef({ yardSaleId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listItemsRef(dataConnect, listItemsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.items);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.items);
});
```

## ListFollows
You can execute the `ListFollows` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listFollows(options?: ExecuteQueryOptions): QueryPromise<ListFollowsData, undefined>;

interface ListFollowsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListFollowsData, undefined>;
}
export const listFollowsRef: ListFollowsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listFollows(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListFollowsData, undefined>;

interface ListFollowsRef {
  ...
  (dc: DataConnect): QueryRef<ListFollowsData, undefined>;
}
export const listFollowsRef: ListFollowsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listFollowsRef:
```typescript
const name = listFollowsRef.operationName;
console.log(name);
```

### Variables
The `ListFollows` query has no variables.
### Return Type
Recall that executing the `ListFollows` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListFollowsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListFollowsData {
  follows: ({
    yardSale: {
      title: string;
    };
  })[];
}
```
### Using `ListFollows`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listFollows } from '@dataconnect/generated';


// Call the `listFollows()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listFollows();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listFollows(dataConnect);

console.log(data.follows);

// Or, you can use the `Promise` API.
listFollows().then((response) => {
  const data = response.data;
  console.log(data.follows);
});
```

### Using `ListFollows`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listFollowsRef } from '@dataconnect/generated';


// Call the `listFollowsRef()` function to get a reference to the query.
const ref = listFollowsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listFollowsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.follows);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.follows);
});
```

## ListMessages
You can execute the `ListMessages` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listMessages(options?: ExecuteQueryOptions): QueryPromise<ListMessagesData, undefined>;

interface ListMessagesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMessagesData, undefined>;
}
export const listMessagesRef: ListMessagesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listMessages(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListMessagesData, undefined>;

interface ListMessagesRef {
  ...
  (dc: DataConnect): QueryRef<ListMessagesData, undefined>;
}
export const listMessagesRef: ListMessagesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listMessagesRef:
```typescript
const name = listMessagesRef.operationName;
console.log(name);
```

### Variables
The `ListMessages` query has no variables.
### Return Type
Recall that executing the `ListMessages` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListMessagesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListMessagesData {
  messages: ({
    sender: {
      username: string;
    };
    content: string;
    timestamp: TimestampString;
  })[];
}
```
### Using `ListMessages`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listMessages } from '@dataconnect/generated';


// Call the `listMessages()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listMessages();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listMessages(dataConnect);

console.log(data.messages);

// Or, you can use the `Promise` API.
listMessages().then((response) => {
  const data = response.data;
  console.log(data.messages);
});
```

### Using `ListMessages`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listMessagesRef } from '@dataconnect/generated';


// Call the `listMessagesRef()` function to get a reference to the query.
const ref = listMessagesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listMessagesRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.messages);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.messages);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## InsertUser
You can execute the `InsertUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
insertUser(vars: InsertUserVariables): MutationPromise<InsertUserData, InsertUserVariables>;

interface InsertUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: InsertUserVariables): MutationRef<InsertUserData, InsertUserVariables>;
}
export const insertUserRef: InsertUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
insertUser(dc: DataConnect, vars: InsertUserVariables): MutationPromise<InsertUserData, InsertUserVariables>;

interface InsertUserRef {
  ...
  (dc: DataConnect, vars: InsertUserVariables): MutationRef<InsertUserData, InsertUserVariables>;
}
export const insertUserRef: InsertUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the insertUserRef:
```typescript
const name = insertUserRef.operationName;
console.log(name);
```

### Variables
The `InsertUser` mutation requires an argument of type `InsertUserVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface InsertUserVariables {
  username: string;
  email: string;
  bio?: string | null;
  profilePictureUrl?: string | null;
}
```
### Return Type
Recall that executing the `InsertUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `InsertUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface InsertUserData {
  user_insert: User_Key;
}
```
### Using `InsertUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, insertUser, InsertUserVariables } from '@dataconnect/generated';

// The `InsertUser` mutation requires an argument of type `InsertUserVariables`:
const insertUserVars: InsertUserVariables = {
  username: ..., 
  email: ..., 
  bio: ..., // optional
  profilePictureUrl: ..., // optional
};

// Call the `insertUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await insertUser(insertUserVars);
// Variables can be defined inline as well.
const { data } = await insertUser({ username: ..., email: ..., bio: ..., profilePictureUrl: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await insertUser(dataConnect, insertUserVars);

console.log(data.user_insert);

// Or, you can use the `Promise` API.
insertUser(insertUserVars).then((response) => {
  const data = response.data;
  console.log(data.user_insert);
});
```

### Using `InsertUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, insertUserRef, InsertUserVariables } from '@dataconnect/generated';

// The `InsertUser` mutation requires an argument of type `InsertUserVariables`:
const insertUserVars: InsertUserVariables = {
  username: ..., 
  email: ..., 
  bio: ..., // optional
  profilePictureUrl: ..., // optional
};

// Call the `insertUserRef()` function to get a reference to the mutation.
const ref = insertUserRef(insertUserVars);
// Variables can be defined inline as well.
const ref = insertUserRef({ username: ..., email: ..., bio: ..., profilePictureUrl: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = insertUserRef(dataConnect, insertUserVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_insert);
});
```

## UpdateUser
You can execute the `UpdateUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateUser(vars?: UpdateUserVariables): MutationPromise<UpdateUserData, UpdateUserVariables>;

interface UpdateUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars?: UpdateUserVariables): MutationRef<UpdateUserData, UpdateUserVariables>;
}
export const updateUserRef: UpdateUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateUser(dc: DataConnect, vars?: UpdateUserVariables): MutationPromise<UpdateUserData, UpdateUserVariables>;

interface UpdateUserRef {
  ...
  (dc: DataConnect, vars?: UpdateUserVariables): MutationRef<UpdateUserData, UpdateUserVariables>;
}
export const updateUserRef: UpdateUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateUserRef:
```typescript
const name = updateUserRef.operationName;
console.log(name);
```

### Variables
The `UpdateUser` mutation has an optional argument of type `UpdateUserVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateUserVariables {
  username?: string | null;
  bio?: string | null;
}
```
### Return Type
Recall that executing the `UpdateUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateUserData {
  user_update?: User_Key | null;
}
```
### Using `UpdateUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateUser, UpdateUserVariables } from '@dataconnect/generated';

// The `UpdateUser` mutation has an optional argument of type `UpdateUserVariables`:
const updateUserVars: UpdateUserVariables = {
  username: ..., // optional
  bio: ..., // optional
};

// Call the `updateUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateUser(updateUserVars);
// Variables can be defined inline as well.
const { data } = await updateUser({ username: ..., bio: ..., });
// Since all variables are optional for this mutation, you can omit the `UpdateUserVariables` argument.
const { data } = await updateUser();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateUser(dataConnect, updateUserVars);

console.log(data.user_update);

// Or, you can use the `Promise` API.
updateUser(updateUserVars).then((response) => {
  const data = response.data;
  console.log(data.user_update);
});
```

### Using `UpdateUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateUserRef, UpdateUserVariables } from '@dataconnect/generated';

// The `UpdateUser` mutation has an optional argument of type `UpdateUserVariables`:
const updateUserVars: UpdateUserVariables = {
  username: ..., // optional
  bio: ..., // optional
};

// Call the `updateUserRef()` function to get a reference to the mutation.
const ref = updateUserRef(updateUserVars);
// Variables can be defined inline as well.
const ref = updateUserRef({ username: ..., bio: ..., });
// Since all variables are optional for this mutation, you can omit the `UpdateUserVariables` argument.
const ref = updateUserRef();

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateUserRef(dataConnect, updateUserVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_update);
});
```

## DeleteUser
You can execute the `DeleteUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteUser(): MutationPromise<DeleteUserData, undefined>;

interface DeleteUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<DeleteUserData, undefined>;
}
export const deleteUserRef: DeleteUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteUser(dc: DataConnect): MutationPromise<DeleteUserData, undefined>;

interface DeleteUserRef {
  ...
  (dc: DataConnect): MutationRef<DeleteUserData, undefined>;
}
export const deleteUserRef: DeleteUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteUserRef:
```typescript
const name = deleteUserRef.operationName;
console.log(name);
```

### Variables
The `DeleteUser` mutation has no variables.
### Return Type
Recall that executing the `DeleteUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteUserData {
  user_delete?: User_Key | null;
}
```
### Using `DeleteUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteUser } from '@dataconnect/generated';


// Call the `deleteUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteUser();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteUser(dataConnect);

console.log(data.user_delete);

// Or, you can use the `Promise` API.
deleteUser().then((response) => {
  const data = response.data;
  console.log(data.user_delete);
});
```

### Using `DeleteUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteUserRef } from '@dataconnect/generated';


// Call the `deleteUserRef()` function to get a reference to the mutation.
const ref = deleteUserRef();

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteUserRef(dataConnect);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_delete);
});
```

## CreateYardSale
You can execute the `CreateYardSale` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createYardSale(vars: CreateYardSaleVariables): MutationPromise<CreateYardSaleData, CreateYardSaleVariables>;

interface CreateYardSaleRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateYardSaleVariables): MutationRef<CreateYardSaleData, CreateYardSaleVariables>;
}
export const createYardSaleRef: CreateYardSaleRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createYardSale(dc: DataConnect, vars: CreateYardSaleVariables): MutationPromise<CreateYardSaleData, CreateYardSaleVariables>;

interface CreateYardSaleRef {
  ...
  (dc: DataConnect, vars: CreateYardSaleVariables): MutationRef<CreateYardSaleData, CreateYardSaleVariables>;
}
export const createYardSaleRef: CreateYardSaleRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createYardSaleRef:
```typescript
const name = createYardSaleRef.operationName;
console.log(name);
```

### Variables
The `CreateYardSale` mutation requires an argument of type `CreateYardSaleVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateYardSaleVariables {
  title: string;
  address: string;
  startTime: TimestampString;
  endTime: TimestampString;
  description?: string | null;
  imageUrl?: string | null;
}
```
### Return Type
Recall that executing the `CreateYardSale` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateYardSaleData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateYardSaleData {
  yardSale_insert: YardSale_Key;
}
```
### Using `CreateYardSale`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createYardSale, CreateYardSaleVariables } from '@dataconnect/generated';

// The `CreateYardSale` mutation requires an argument of type `CreateYardSaleVariables`:
const createYardSaleVars: CreateYardSaleVariables = {
  title: ..., 
  address: ..., 
  startTime: ..., 
  endTime: ..., 
  description: ..., // optional
  imageUrl: ..., // optional
};

// Call the `createYardSale()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createYardSale(createYardSaleVars);
// Variables can be defined inline as well.
const { data } = await createYardSale({ title: ..., address: ..., startTime: ..., endTime: ..., description: ..., imageUrl: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createYardSale(dataConnect, createYardSaleVars);

console.log(data.yardSale_insert);

// Or, you can use the `Promise` API.
createYardSale(createYardSaleVars).then((response) => {
  const data = response.data;
  console.log(data.yardSale_insert);
});
```

### Using `CreateYardSale`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createYardSaleRef, CreateYardSaleVariables } from '@dataconnect/generated';

// The `CreateYardSale` mutation requires an argument of type `CreateYardSaleVariables`:
const createYardSaleVars: CreateYardSaleVariables = {
  title: ..., 
  address: ..., 
  startTime: ..., 
  endTime: ..., 
  description: ..., // optional
  imageUrl: ..., // optional
};

// Call the `createYardSaleRef()` function to get a reference to the mutation.
const ref = createYardSaleRef(createYardSaleVars);
// Variables can be defined inline as well.
const ref = createYardSaleRef({ title: ..., address: ..., startTime: ..., endTime: ..., description: ..., imageUrl: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createYardSaleRef(dataConnect, createYardSaleVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.yardSale_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.yardSale_insert);
});
```

## UpdateYardSale
You can execute the `UpdateYardSale` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateYardSale(vars: UpdateYardSaleVariables): MutationPromise<UpdateYardSaleData, UpdateYardSaleVariables>;

interface UpdateYardSaleRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateYardSaleVariables): MutationRef<UpdateYardSaleData, UpdateYardSaleVariables>;
}
export const updateYardSaleRef: UpdateYardSaleRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateYardSale(dc: DataConnect, vars: UpdateYardSaleVariables): MutationPromise<UpdateYardSaleData, UpdateYardSaleVariables>;

interface UpdateYardSaleRef {
  ...
  (dc: DataConnect, vars: UpdateYardSaleVariables): MutationRef<UpdateYardSaleData, UpdateYardSaleVariables>;
}
export const updateYardSaleRef: UpdateYardSaleRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateYardSaleRef:
```typescript
const name = updateYardSaleRef.operationName;
console.log(name);
```

### Variables
The `UpdateYardSale` mutation requires an argument of type `UpdateYardSaleVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateYardSaleVariables {
  id: UUIDString;
  title?: string | null;
}
```
### Return Type
Recall that executing the `UpdateYardSale` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateYardSaleData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateYardSaleData {
  yardSale_update?: YardSale_Key | null;
}
```
### Using `UpdateYardSale`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateYardSale, UpdateYardSaleVariables } from '@dataconnect/generated';

// The `UpdateYardSale` mutation requires an argument of type `UpdateYardSaleVariables`:
const updateYardSaleVars: UpdateYardSaleVariables = {
  id: ..., 
  title: ..., // optional
};

// Call the `updateYardSale()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateYardSale(updateYardSaleVars);
// Variables can be defined inline as well.
const { data } = await updateYardSale({ id: ..., title: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateYardSale(dataConnect, updateYardSaleVars);

console.log(data.yardSale_update);

// Or, you can use the `Promise` API.
updateYardSale(updateYardSaleVars).then((response) => {
  const data = response.data;
  console.log(data.yardSale_update);
});
```

### Using `UpdateYardSale`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateYardSaleRef, UpdateYardSaleVariables } from '@dataconnect/generated';

// The `UpdateYardSale` mutation requires an argument of type `UpdateYardSaleVariables`:
const updateYardSaleVars: UpdateYardSaleVariables = {
  id: ..., 
  title: ..., // optional
};

// Call the `updateYardSaleRef()` function to get a reference to the mutation.
const ref = updateYardSaleRef(updateYardSaleVars);
// Variables can be defined inline as well.
const ref = updateYardSaleRef({ id: ..., title: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateYardSaleRef(dataConnect, updateYardSaleVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.yardSale_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.yardSale_update);
});
```

## DeleteYardSale
You can execute the `DeleteYardSale` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteYardSale(vars: DeleteYardSaleVariables): MutationPromise<DeleteYardSaleData, DeleteYardSaleVariables>;

interface DeleteYardSaleRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteYardSaleVariables): MutationRef<DeleteYardSaleData, DeleteYardSaleVariables>;
}
export const deleteYardSaleRef: DeleteYardSaleRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteYardSale(dc: DataConnect, vars: DeleteYardSaleVariables): MutationPromise<DeleteYardSaleData, DeleteYardSaleVariables>;

interface DeleteYardSaleRef {
  ...
  (dc: DataConnect, vars: DeleteYardSaleVariables): MutationRef<DeleteYardSaleData, DeleteYardSaleVariables>;
}
export const deleteYardSaleRef: DeleteYardSaleRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteYardSaleRef:
```typescript
const name = deleteYardSaleRef.operationName;
console.log(name);
```

### Variables
The `DeleteYardSale` mutation requires an argument of type `DeleteYardSaleVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteYardSaleVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteYardSale` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteYardSaleData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteYardSaleData {
  yardSale_delete?: YardSale_Key | null;
}
```
### Using `DeleteYardSale`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteYardSale, DeleteYardSaleVariables } from '@dataconnect/generated';

// The `DeleteYardSale` mutation requires an argument of type `DeleteYardSaleVariables`:
const deleteYardSaleVars: DeleteYardSaleVariables = {
  id: ..., 
};

// Call the `deleteYardSale()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteYardSale(deleteYardSaleVars);
// Variables can be defined inline as well.
const { data } = await deleteYardSale({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteYardSale(dataConnect, deleteYardSaleVars);

console.log(data.yardSale_delete);

// Or, you can use the `Promise` API.
deleteYardSale(deleteYardSaleVars).then((response) => {
  const data = response.data;
  console.log(data.yardSale_delete);
});
```

### Using `DeleteYardSale`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteYardSaleRef, DeleteYardSaleVariables } from '@dataconnect/generated';

// The `DeleteYardSale` mutation requires an argument of type `DeleteYardSaleVariables`:
const deleteYardSaleVars: DeleteYardSaleVariables = {
  id: ..., 
};

// Call the `deleteYardSaleRef()` function to get a reference to the mutation.
const ref = deleteYardSaleRef(deleteYardSaleVars);
// Variables can be defined inline as well.
const ref = deleteYardSaleRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteYardSaleRef(dataConnect, deleteYardSaleVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.yardSale_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.yardSale_delete);
});
```

## CreateItem
You can execute the `CreateItem` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createItem(vars: CreateItemVariables): MutationPromise<CreateItemData, CreateItemVariables>;

interface CreateItemRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateItemVariables): MutationRef<CreateItemData, CreateItemVariables>;
}
export const createItemRef: CreateItemRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createItem(dc: DataConnect, vars: CreateItemVariables): MutationPromise<CreateItemData, CreateItemVariables>;

interface CreateItemRef {
  ...
  (dc: DataConnect, vars: CreateItemVariables): MutationRef<CreateItemData, CreateItemVariables>;
}
export const createItemRef: CreateItemRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createItemRef:
```typescript
const name = createItemRef.operationName;
console.log(name);
```

### Variables
The `CreateItem` mutation requires an argument of type `CreateItemVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateItemVariables {
  yardSaleId: UUIDString;
  title: string;
  price: number;
  description?: string | null;
  imageUrl?: string | null;
}
```
### Return Type
Recall that executing the `CreateItem` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateItemData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateItemData {
  item_insert: Item_Key;
}
```
### Using `CreateItem`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createItem, CreateItemVariables } from '@dataconnect/generated';

// The `CreateItem` mutation requires an argument of type `CreateItemVariables`:
const createItemVars: CreateItemVariables = {
  yardSaleId: ..., 
  title: ..., 
  price: ..., 
  description: ..., // optional
  imageUrl: ..., // optional
};

// Call the `createItem()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createItem(createItemVars);
// Variables can be defined inline as well.
const { data } = await createItem({ yardSaleId: ..., title: ..., price: ..., description: ..., imageUrl: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createItem(dataConnect, createItemVars);

console.log(data.item_insert);

// Or, you can use the `Promise` API.
createItem(createItemVars).then((response) => {
  const data = response.data;
  console.log(data.item_insert);
});
```

### Using `CreateItem`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createItemRef, CreateItemVariables } from '@dataconnect/generated';

// The `CreateItem` mutation requires an argument of type `CreateItemVariables`:
const createItemVars: CreateItemVariables = {
  yardSaleId: ..., 
  title: ..., 
  price: ..., 
  description: ..., // optional
  imageUrl: ..., // optional
};

// Call the `createItemRef()` function to get a reference to the mutation.
const ref = createItemRef(createItemVars);
// Variables can be defined inline as well.
const ref = createItemRef({ yardSaleId: ..., title: ..., price: ..., description: ..., imageUrl: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createItemRef(dataConnect, createItemVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.item_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.item_insert);
});
```

## UpdateItem
You can execute the `UpdateItem` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateItem(vars: UpdateItemVariables): MutationPromise<UpdateItemData, UpdateItemVariables>;

interface UpdateItemRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateItemVariables): MutationRef<UpdateItemData, UpdateItemVariables>;
}
export const updateItemRef: UpdateItemRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateItem(dc: DataConnect, vars: UpdateItemVariables): MutationPromise<UpdateItemData, UpdateItemVariables>;

interface UpdateItemRef {
  ...
  (dc: DataConnect, vars: UpdateItemVariables): MutationRef<UpdateItemData, UpdateItemVariables>;
}
export const updateItemRef: UpdateItemRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateItemRef:
```typescript
const name = updateItemRef.operationName;
console.log(name);
```

### Variables
The `UpdateItem` mutation requires an argument of type `UpdateItemVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateItemVariables {
  id: UUIDString;
  isSold?: boolean | null;
}
```
### Return Type
Recall that executing the `UpdateItem` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateItemData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateItemData {
  item_update?: Item_Key | null;
}
```
### Using `UpdateItem`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateItem, UpdateItemVariables } from '@dataconnect/generated';

// The `UpdateItem` mutation requires an argument of type `UpdateItemVariables`:
const updateItemVars: UpdateItemVariables = {
  id: ..., 
  isSold: ..., // optional
};

// Call the `updateItem()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateItem(updateItemVars);
// Variables can be defined inline as well.
const { data } = await updateItem({ id: ..., isSold: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateItem(dataConnect, updateItemVars);

console.log(data.item_update);

// Or, you can use the `Promise` API.
updateItem(updateItemVars).then((response) => {
  const data = response.data;
  console.log(data.item_update);
});
```

### Using `UpdateItem`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateItemRef, UpdateItemVariables } from '@dataconnect/generated';

// The `UpdateItem` mutation requires an argument of type `UpdateItemVariables`:
const updateItemVars: UpdateItemVariables = {
  id: ..., 
  isSold: ..., // optional
};

// Call the `updateItemRef()` function to get a reference to the mutation.
const ref = updateItemRef(updateItemVars);
// Variables can be defined inline as well.
const ref = updateItemRef({ id: ..., isSold: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateItemRef(dataConnect, updateItemVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.item_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.item_update);
});
```

## DeleteItem
You can execute the `DeleteItem` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteItem(vars: DeleteItemVariables): MutationPromise<DeleteItemData, DeleteItemVariables>;

interface DeleteItemRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteItemVariables): MutationRef<DeleteItemData, DeleteItemVariables>;
}
export const deleteItemRef: DeleteItemRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteItem(dc: DataConnect, vars: DeleteItemVariables): MutationPromise<DeleteItemData, DeleteItemVariables>;

interface DeleteItemRef {
  ...
  (dc: DataConnect, vars: DeleteItemVariables): MutationRef<DeleteItemData, DeleteItemVariables>;
}
export const deleteItemRef: DeleteItemRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteItemRef:
```typescript
const name = deleteItemRef.operationName;
console.log(name);
```

### Variables
The `DeleteItem` mutation requires an argument of type `DeleteItemVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteItemVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteItem` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteItemData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteItemData {
  item_delete?: Item_Key | null;
}
```
### Using `DeleteItem`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteItem, DeleteItemVariables } from '@dataconnect/generated';

// The `DeleteItem` mutation requires an argument of type `DeleteItemVariables`:
const deleteItemVars: DeleteItemVariables = {
  id: ..., 
};

// Call the `deleteItem()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteItem(deleteItemVars);
// Variables can be defined inline as well.
const { data } = await deleteItem({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteItem(dataConnect, deleteItemVars);

console.log(data.item_delete);

// Or, you can use the `Promise` API.
deleteItem(deleteItemVars).then((response) => {
  const data = response.data;
  console.log(data.item_delete);
});
```

### Using `DeleteItem`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteItemRef, DeleteItemVariables } from '@dataconnect/generated';

// The `DeleteItem` mutation requires an argument of type `DeleteItemVariables`:
const deleteItemVars: DeleteItemVariables = {
  id: ..., 
};

// Call the `deleteItemRef()` function to get a reference to the mutation.
const ref = deleteItemRef(deleteItemVars);
// Variables can be defined inline as well.
const ref = deleteItemRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteItemRef(dataConnect, deleteItemVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.item_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.item_delete);
});
```

## CreateFollow
You can execute the `CreateFollow` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createFollow(vars: CreateFollowVariables): MutationPromise<CreateFollowData, CreateFollowVariables>;

interface CreateFollowRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateFollowVariables): MutationRef<CreateFollowData, CreateFollowVariables>;
}
export const createFollowRef: CreateFollowRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createFollow(dc: DataConnect, vars: CreateFollowVariables): MutationPromise<CreateFollowData, CreateFollowVariables>;

interface CreateFollowRef {
  ...
  (dc: DataConnect, vars: CreateFollowVariables): MutationRef<CreateFollowData, CreateFollowVariables>;
}
export const createFollowRef: CreateFollowRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createFollowRef:
```typescript
const name = createFollowRef.operationName;
console.log(name);
```

### Variables
The `CreateFollow` mutation requires an argument of type `CreateFollowVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateFollowVariables {
  yardSaleId: UUIDString;
}
```
### Return Type
Recall that executing the `CreateFollow` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateFollowData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateFollowData {
  follow_insert: Follow_Key;
}
```
### Using `CreateFollow`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createFollow, CreateFollowVariables } from '@dataconnect/generated';

// The `CreateFollow` mutation requires an argument of type `CreateFollowVariables`:
const createFollowVars: CreateFollowVariables = {
  yardSaleId: ..., 
};

// Call the `createFollow()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createFollow(createFollowVars);
// Variables can be defined inline as well.
const { data } = await createFollow({ yardSaleId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createFollow(dataConnect, createFollowVars);

console.log(data.follow_insert);

// Or, you can use the `Promise` API.
createFollow(createFollowVars).then((response) => {
  const data = response.data;
  console.log(data.follow_insert);
});
```

### Using `CreateFollow`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createFollowRef, CreateFollowVariables } from '@dataconnect/generated';

// The `CreateFollow` mutation requires an argument of type `CreateFollowVariables`:
const createFollowVars: CreateFollowVariables = {
  yardSaleId: ..., 
};

// Call the `createFollowRef()` function to get a reference to the mutation.
const ref = createFollowRef(createFollowVars);
// Variables can be defined inline as well.
const ref = createFollowRef({ yardSaleId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createFollowRef(dataConnect, createFollowVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.follow_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.follow_insert);
});
```

## DeleteFollow
You can execute the `DeleteFollow` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
deleteFollow(vars: DeleteFollowVariables): MutationPromise<DeleteFollowData, DeleteFollowVariables>;

interface DeleteFollowRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteFollowVariables): MutationRef<DeleteFollowData, DeleteFollowVariables>;
}
export const deleteFollowRef: DeleteFollowRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
deleteFollow(dc: DataConnect, vars: DeleteFollowVariables): MutationPromise<DeleteFollowData, DeleteFollowVariables>;

interface DeleteFollowRef {
  ...
  (dc: DataConnect, vars: DeleteFollowVariables): MutationRef<DeleteFollowData, DeleteFollowVariables>;
}
export const deleteFollowRef: DeleteFollowRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the deleteFollowRef:
```typescript
const name = deleteFollowRef.operationName;
console.log(name);
```

### Variables
The `DeleteFollow` mutation requires an argument of type `DeleteFollowVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DeleteFollowVariables {
  yardSaleId: UUIDString;
}
```
### Return Type
Recall that executing the `DeleteFollow` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DeleteFollowData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DeleteFollowData {
  follow_delete?: Follow_Key | null;
}
```
### Using `DeleteFollow`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, deleteFollow, DeleteFollowVariables } from '@dataconnect/generated';

// The `DeleteFollow` mutation requires an argument of type `DeleteFollowVariables`:
const deleteFollowVars: DeleteFollowVariables = {
  yardSaleId: ..., 
};

// Call the `deleteFollow()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await deleteFollow(deleteFollowVars);
// Variables can be defined inline as well.
const { data } = await deleteFollow({ yardSaleId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await deleteFollow(dataConnect, deleteFollowVars);

console.log(data.follow_delete);

// Or, you can use the `Promise` API.
deleteFollow(deleteFollowVars).then((response) => {
  const data = response.data;
  console.log(data.follow_delete);
});
```

### Using `DeleteFollow`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, deleteFollowRef, DeleteFollowVariables } from '@dataconnect/generated';

// The `DeleteFollow` mutation requires an argument of type `DeleteFollowVariables`:
const deleteFollowVars: DeleteFollowVariables = {
  yardSaleId: ..., 
};

// Call the `deleteFollowRef()` function to get a reference to the mutation.
const ref = deleteFollowRef(deleteFollowVars);
// Variables can be defined inline as well.
const ref = deleteFollowRef({ yardSaleId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = deleteFollowRef(dataConnect, deleteFollowVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.follow_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.follow_delete);
});
```

## SendMessage
You can execute the `SendMessage` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
sendMessage(vars: SendMessageVariables): MutationPromise<SendMessageData, SendMessageVariables>;

interface SendMessageRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: SendMessageVariables): MutationRef<SendMessageData, SendMessageVariables>;
}
export const sendMessageRef: SendMessageRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
sendMessage(dc: DataConnect, vars: SendMessageVariables): MutationPromise<SendMessageData, SendMessageVariables>;

interface SendMessageRef {
  ...
  (dc: DataConnect, vars: SendMessageVariables): MutationRef<SendMessageData, SendMessageVariables>;
}
export const sendMessageRef: SendMessageRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the sendMessageRef:
```typescript
const name = sendMessageRef.operationName;
console.log(name);
```

### Variables
The `SendMessage` mutation requires an argument of type `SendMessageVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface SendMessageVariables {
  receiverId: UUIDString;
  content: string;
  itemId?: UUIDString | null;
}
```
### Return Type
Recall that executing the `SendMessage` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `SendMessageData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface SendMessageData {
  message_insert: Message_Key;
}
```
### Using `SendMessage`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, sendMessage, SendMessageVariables } from '@dataconnect/generated';

// The `SendMessage` mutation requires an argument of type `SendMessageVariables`:
const sendMessageVars: SendMessageVariables = {
  receiverId: ..., 
  content: ..., 
  itemId: ..., // optional
};

// Call the `sendMessage()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await sendMessage(sendMessageVars);
// Variables can be defined inline as well.
const { data } = await sendMessage({ receiverId: ..., content: ..., itemId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await sendMessage(dataConnect, sendMessageVars);

console.log(data.message_insert);

// Or, you can use the `Promise` API.
sendMessage(sendMessageVars).then((response) => {
  const data = response.data;
  console.log(data.message_insert);
});
```

### Using `SendMessage`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, sendMessageRef, SendMessageVariables } from '@dataconnect/generated';

// The `SendMessage` mutation requires an argument of type `SendMessageVariables`:
const sendMessageVars: SendMessageVariables = {
  receiverId: ..., 
  content: ..., 
  itemId: ..., // optional
};

// Call the `sendMessageRef()` function to get a reference to the mutation.
const ref = sendMessageRef(sendMessageVars);
// Variables can be defined inline as well.
const ref = sendMessageRef({ receiverId: ..., content: ..., itemId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = sendMessageRef(dataConnect, sendMessageVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.message_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.message_insert);
});
```

