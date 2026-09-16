import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise, DataConnectSettings } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;
export const dataConnectSettings: DataConnectSettings;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface CreateFollowData {
  follow_insert: Follow_Key;
}

export interface CreateFollowVariables {
  yardSaleId: UUIDString;
}

export interface CreateItemData {
  item_insert: Item_Key;
}

export interface CreateItemVariables {
  yardSaleId: UUIDString;
  title: string;
  price: number;
  description?: string | null;
  imageUrl?: string | null;
}

export interface CreateYardSaleData {
  yardSale_insert: YardSale_Key;
}

export interface CreateYardSaleVariables {
  title: string;
  address: string;
  startTime: TimestampString;
  endTime: TimestampString;
  description?: string | null;
  imageUrl?: string | null;
}

export interface DeleteFollowData {
  follow_delete?: Follow_Key | null;
}

export interface DeleteFollowVariables {
  yardSaleId: UUIDString;
}

export interface DeleteItemData {
  item_delete?: Item_Key | null;
}

export interface DeleteItemVariables {
  id: UUIDString;
}

export interface DeleteUserData {
  user_delete?: User_Key | null;
}

export interface DeleteYardSaleData {
  yardSale_delete?: YardSale_Key | null;
}

export interface DeleteYardSaleVariables {
  id: UUIDString;
}

export interface Follow_Key {
  id: UUIDString;
  __typename?: 'Follow_Key';
}

export interface GetItemData {
  item?: {
    title: string;
    price: number;
    description?: string | null;
    imageUrl?: string | null;
    isSold?: boolean | null;
  };
}

export interface GetItemVariables {
  id: UUIDString;
}

export interface GetUserData {
  user?: {
    username: string;
    email: string;
    bio?: string | null;
    profilePictureUrl?: string | null;
  };
}

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

export interface GetYardSaleVariables {
  id: UUIDString;
}

export interface InsertUserData {
  user_insert: User_Key;
}

export interface InsertUserVariables {
  username: string;
  email: string;
  bio?: string | null;
  profilePictureUrl?: string | null;
}

export interface Item_Key {
  id: UUIDString;
  __typename?: 'Item_Key';
}

export interface ListFollowsData {
  follows: ({
    yardSale: {
      title: string;
    };
  })[];
}

export interface ListItemsData {
  items: ({
    title: string;
    price: number;
    isSold?: boolean | null;
  })[];
}

export interface ListItemsVariables {
  yardSaleId: UUIDString;
}

export interface ListMessagesData {
  messages: ({
    sender: {
      username: string;
    };
    content: string;
    timestamp: TimestampString;
  })[];
}

export interface ListUsersData {
  users: ({
    username: string;
    profilePictureUrl?: string | null;
  })[];
}

export interface ListYardSalesData {
  yardSales: ({
    title: string;
    address: string;
    startTime: TimestampString;
    endTime: TimestampString;
  })[];
}

export interface Message_Key {
  id: UUIDString;
  __typename?: 'Message_Key';
}

export interface SendMessageData {
  message_insert: Message_Key;
}

export interface SendMessageVariables {
  receiverId: UUIDString;
  content: string;
  itemId?: UUIDString | null;
}

export interface UpdateItemData {
  item_update?: Item_Key | null;
}

export interface UpdateItemVariables {
  id: UUIDString;
  isSold?: boolean | null;
}

export interface UpdateUserData {
  user_update?: User_Key | null;
}

export interface UpdateUserVariables {
  username?: string | null;
  bio?: string | null;
}

export interface UpdateYardSaleData {
  yardSale_update?: YardSale_Key | null;
}

export interface UpdateYardSaleVariables {
  id: UUIDString;
  title?: string | null;
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

export interface YardSale_Key {
  id: UUIDString;
  __typename?: 'YardSale_Key';
}

interface InsertUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: InsertUserVariables): MutationRef<InsertUserData, InsertUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: InsertUserVariables): MutationRef<InsertUserData, InsertUserVariables>;
  operationName: string;
}
export const insertUserRef: InsertUserRef;

export function insertUser(vars: InsertUserVariables): MutationPromise<InsertUserData, InsertUserVariables>;
export function insertUser(dc: DataConnect, vars: InsertUserVariables): MutationPromise<InsertUserData, InsertUserVariables>;

interface UpdateUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars?: UpdateUserVariables): MutationRef<UpdateUserData, UpdateUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars?: UpdateUserVariables): MutationRef<UpdateUserData, UpdateUserVariables>;
  operationName: string;
}
export const updateUserRef: UpdateUserRef;

export function updateUser(vars?: UpdateUserVariables): MutationPromise<UpdateUserData, UpdateUserVariables>;
export function updateUser(dc: DataConnect, vars?: UpdateUserVariables): MutationPromise<UpdateUserData, UpdateUserVariables>;

interface DeleteUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (): MutationRef<DeleteUserData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): MutationRef<DeleteUserData, undefined>;
  operationName: string;
}
export const deleteUserRef: DeleteUserRef;

export function deleteUser(): MutationPromise<DeleteUserData, undefined>;
export function deleteUser(dc: DataConnect): MutationPromise<DeleteUserData, undefined>;

interface GetUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetUserData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetUserData, undefined>;
  operationName: string;
}
export const getUserRef: GetUserRef;

export function getUser(options?: ExecuteQueryOptions): QueryPromise<GetUserData, undefined>;
export function getUser(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetUserData, undefined>;

interface ListUsersRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListUsersData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListUsersData, undefined>;
  operationName: string;
}
export const listUsersRef: ListUsersRef;

export function listUsers(options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;
export function listUsers(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListUsersData, undefined>;

interface CreateYardSaleRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateYardSaleVariables): MutationRef<CreateYardSaleData, CreateYardSaleVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateYardSaleVariables): MutationRef<CreateYardSaleData, CreateYardSaleVariables>;
  operationName: string;
}
export const createYardSaleRef: CreateYardSaleRef;

export function createYardSale(vars: CreateYardSaleVariables): MutationPromise<CreateYardSaleData, CreateYardSaleVariables>;
export function createYardSale(dc: DataConnect, vars: CreateYardSaleVariables): MutationPromise<CreateYardSaleData, CreateYardSaleVariables>;

interface UpdateYardSaleRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateYardSaleVariables): MutationRef<UpdateYardSaleData, UpdateYardSaleVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateYardSaleVariables): MutationRef<UpdateYardSaleData, UpdateYardSaleVariables>;
  operationName: string;
}
export const updateYardSaleRef: UpdateYardSaleRef;

export function updateYardSale(vars: UpdateYardSaleVariables): MutationPromise<UpdateYardSaleData, UpdateYardSaleVariables>;
export function updateYardSale(dc: DataConnect, vars: UpdateYardSaleVariables): MutationPromise<UpdateYardSaleData, UpdateYardSaleVariables>;

interface DeleteYardSaleRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteYardSaleVariables): MutationRef<DeleteYardSaleData, DeleteYardSaleVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteYardSaleVariables): MutationRef<DeleteYardSaleData, DeleteYardSaleVariables>;
  operationName: string;
}
export const deleteYardSaleRef: DeleteYardSaleRef;

export function deleteYardSale(vars: DeleteYardSaleVariables): MutationPromise<DeleteYardSaleData, DeleteYardSaleVariables>;
export function deleteYardSale(dc: DataConnect, vars: DeleteYardSaleVariables): MutationPromise<DeleteYardSaleData, DeleteYardSaleVariables>;

interface GetYardSaleRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetYardSaleVariables): QueryRef<GetYardSaleData, GetYardSaleVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetYardSaleVariables): QueryRef<GetYardSaleData, GetYardSaleVariables>;
  operationName: string;
}
export const getYardSaleRef: GetYardSaleRef;

export function getYardSale(vars: GetYardSaleVariables, options?: ExecuteQueryOptions): QueryPromise<GetYardSaleData, GetYardSaleVariables>;
export function getYardSale(dc: DataConnect, vars: GetYardSaleVariables, options?: ExecuteQueryOptions): QueryPromise<GetYardSaleData, GetYardSaleVariables>;

interface ListYardSalesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListYardSalesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListYardSalesData, undefined>;
  operationName: string;
}
export const listYardSalesRef: ListYardSalesRef;

export function listYardSales(options?: ExecuteQueryOptions): QueryPromise<ListYardSalesData, undefined>;
export function listYardSales(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListYardSalesData, undefined>;

interface CreateItemRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateItemVariables): MutationRef<CreateItemData, CreateItemVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateItemVariables): MutationRef<CreateItemData, CreateItemVariables>;
  operationName: string;
}
export const createItemRef: CreateItemRef;

export function createItem(vars: CreateItemVariables): MutationPromise<CreateItemData, CreateItemVariables>;
export function createItem(dc: DataConnect, vars: CreateItemVariables): MutationPromise<CreateItemData, CreateItemVariables>;

interface UpdateItemRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateItemVariables): MutationRef<UpdateItemData, UpdateItemVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateItemVariables): MutationRef<UpdateItemData, UpdateItemVariables>;
  operationName: string;
}
export const updateItemRef: UpdateItemRef;

export function updateItem(vars: UpdateItemVariables): MutationPromise<UpdateItemData, UpdateItemVariables>;
export function updateItem(dc: DataConnect, vars: UpdateItemVariables): MutationPromise<UpdateItemData, UpdateItemVariables>;

interface DeleteItemRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteItemVariables): MutationRef<DeleteItemData, DeleteItemVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteItemVariables): MutationRef<DeleteItemData, DeleteItemVariables>;
  operationName: string;
}
export const deleteItemRef: DeleteItemRef;

export function deleteItem(vars: DeleteItemVariables): MutationPromise<DeleteItemData, DeleteItemVariables>;
export function deleteItem(dc: DataConnect, vars: DeleteItemVariables): MutationPromise<DeleteItemData, DeleteItemVariables>;

interface GetItemRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetItemVariables): QueryRef<GetItemData, GetItemVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetItemVariables): QueryRef<GetItemData, GetItemVariables>;
  operationName: string;
}
export const getItemRef: GetItemRef;

export function getItem(vars: GetItemVariables, options?: ExecuteQueryOptions): QueryPromise<GetItemData, GetItemVariables>;
export function getItem(dc: DataConnect, vars: GetItemVariables, options?: ExecuteQueryOptions): QueryPromise<GetItemData, GetItemVariables>;

interface ListItemsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ListItemsVariables): QueryRef<ListItemsData, ListItemsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ListItemsVariables): QueryRef<ListItemsData, ListItemsVariables>;
  operationName: string;
}
export const listItemsRef: ListItemsRef;

export function listItems(vars: ListItemsVariables, options?: ExecuteQueryOptions): QueryPromise<ListItemsData, ListItemsVariables>;
export function listItems(dc: DataConnect, vars: ListItemsVariables, options?: ExecuteQueryOptions): QueryPromise<ListItemsData, ListItemsVariables>;

interface CreateFollowRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateFollowVariables): MutationRef<CreateFollowData, CreateFollowVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateFollowVariables): MutationRef<CreateFollowData, CreateFollowVariables>;
  operationName: string;
}
export const createFollowRef: CreateFollowRef;

export function createFollow(vars: CreateFollowVariables): MutationPromise<CreateFollowData, CreateFollowVariables>;
export function createFollow(dc: DataConnect, vars: CreateFollowVariables): MutationPromise<CreateFollowData, CreateFollowVariables>;

interface DeleteFollowRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DeleteFollowVariables): MutationRef<DeleteFollowData, DeleteFollowVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DeleteFollowVariables): MutationRef<DeleteFollowData, DeleteFollowVariables>;
  operationName: string;
}
export const deleteFollowRef: DeleteFollowRef;

export function deleteFollow(vars: DeleteFollowVariables): MutationPromise<DeleteFollowData, DeleteFollowVariables>;
export function deleteFollow(dc: DataConnect, vars: DeleteFollowVariables): MutationPromise<DeleteFollowData, DeleteFollowVariables>;

interface ListFollowsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListFollowsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListFollowsData, undefined>;
  operationName: string;
}
export const listFollowsRef: ListFollowsRef;

export function listFollows(options?: ExecuteQueryOptions): QueryPromise<ListFollowsData, undefined>;
export function listFollows(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListFollowsData, undefined>;

interface SendMessageRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: SendMessageVariables): MutationRef<SendMessageData, SendMessageVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: SendMessageVariables): MutationRef<SendMessageData, SendMessageVariables>;
  operationName: string;
}
export const sendMessageRef: SendMessageRef;

export function sendMessage(vars: SendMessageVariables): MutationPromise<SendMessageData, SendMessageVariables>;
export function sendMessage(dc: DataConnect, vars: SendMessageVariables): MutationPromise<SendMessageData, SendMessageVariables>;

interface ListMessagesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListMessagesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListMessagesData, undefined>;
  operationName: string;
}
export const listMessagesRef: ListMessagesRef;

export function listMessages(options?: ExecuteQueryOptions): QueryPromise<ListMessagesData, undefined>;
export function listMessages(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListMessagesData, undefined>;

