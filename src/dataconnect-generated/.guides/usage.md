# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.




### React
For each operation, there is a wrapper hook that can be used to call the operation.

Here are all of the hooks that get generated:
```ts
import { useInsertUser, useUpdateUser, useDeleteUser, useGetUser, useListUsers, useCreateYardSale, useUpdateYardSale, useDeleteYardSale, useGetYardSale, useListYardSales } from '@dataconnect/generated/react';
// The types of these hooks are available in react/index.d.ts

const { data, isPending, isSuccess, isError, error } = useInsertUser(insertUserVars);

const { data, isPending, isSuccess, isError, error } = useUpdateUser(updateUserVars);

const { data, isPending, isSuccess, isError, error } = useDeleteUser();

const { data, isPending, isSuccess, isError, error } = useGetUser();

const { data, isPending, isSuccess, isError, error } = useListUsers();

const { data, isPending, isSuccess, isError, error } = useCreateYardSale(createYardSaleVars);

const { data, isPending, isSuccess, isError, error } = useUpdateYardSale(updateYardSaleVars);

const { data, isPending, isSuccess, isError, error } = useDeleteYardSale(deleteYardSaleVars);

const { data, isPending, isSuccess, isError, error } = useGetYardSale(getYardSaleVars);

const { data, isPending, isSuccess, isError, error } = useListYardSales();

```

Here's an example from a different generated SDK:

```ts
import { useListAllMovies } from '@dataconnect/generated/react';

function MyComponent() {
  const { isLoading, data, error } = useListAllMovies();
  if(isLoading) {
    return <div>Loading...</div>
  }
  if(error) {
    return <div> An Error Occurred: {error} </div>
  }
}

// App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyComponent from './my-component';

function App() {
  const queryClient = new QueryClient();
  return <QueryClientProvider client={queryClient}>
    <MyComponent />
  </QueryClientProvider>
}
```



## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { insertUser, updateUser, deleteUser, getUser, listUsers, createYardSale, updateYardSale, deleteYardSale, getYardSale, listYardSales } from '@dataconnect/generated';


// Operation InsertUser:  For variables, look at type InsertUserVars in ../index.d.ts
const { data } = await InsertUser(dataConnect, insertUserVars);

// Operation UpdateUser:  For variables, look at type UpdateUserVars in ../index.d.ts
const { data } = await UpdateUser(dataConnect, updateUserVars);

// Operation DeleteUser: 
const { data } = await DeleteUser(dataConnect);

// Operation GetUser: 
const { data } = await GetUser(dataConnect);

// Operation ListUsers: 
const { data } = await ListUsers(dataConnect);

// Operation CreateYardSale:  For variables, look at type CreateYardSaleVars in ../index.d.ts
const { data } = await CreateYardSale(dataConnect, createYardSaleVars);

// Operation UpdateYardSale:  For variables, look at type UpdateYardSaleVars in ../index.d.ts
const { data } = await UpdateYardSale(dataConnect, updateYardSaleVars);

// Operation DeleteYardSale:  For variables, look at type DeleteYardSaleVars in ../index.d.ts
const { data } = await DeleteYardSale(dataConnect, deleteYardSaleVars);

// Operation GetYardSale:  For variables, look at type GetYardSaleVars in ../index.d.ts
const { data } = await GetYardSale(dataConnect, getYardSaleVars);

// Operation ListYardSales: 
const { data } = await ListYardSales(dataConnect);


```