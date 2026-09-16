import { InsertUserData, InsertUserVariables, UpdateUserData, UpdateUserVariables, DeleteUserData, GetUserData, ListUsersData, CreateYardSaleData, CreateYardSaleVariables, UpdateYardSaleData, UpdateYardSaleVariables, DeleteYardSaleData, DeleteYardSaleVariables, GetYardSaleData, GetYardSaleVariables, ListYardSalesData, CreateItemData, CreateItemVariables, UpdateItemData, UpdateItemVariables, DeleteItemData, DeleteItemVariables, GetItemData, GetItemVariables, ListItemsData, ListItemsVariables, CreateFollowData, CreateFollowVariables, DeleteFollowData, DeleteFollowVariables, ListFollowsData, SendMessageData, SendMessageVariables, ListMessagesData } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useInsertUser(options?: useDataConnectMutationOptions<InsertUserData, FirebaseError, InsertUserVariables>): UseDataConnectMutationResult<InsertUserData, InsertUserVariables>;
export function useInsertUser(dc: DataConnect, options?: useDataConnectMutationOptions<InsertUserData, FirebaseError, InsertUserVariables>): UseDataConnectMutationResult<InsertUserData, InsertUserVariables>;

export function useUpdateUser(options?: useDataConnectMutationOptions<UpdateUserData, FirebaseError, UpdateUserVariables | void>): UseDataConnectMutationResult<UpdateUserData, UpdateUserVariables>;
export function useUpdateUser(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateUserData, FirebaseError, UpdateUserVariables | void>): UseDataConnectMutationResult<UpdateUserData, UpdateUserVariables>;

export function useDeleteUser(options?: useDataConnectMutationOptions<DeleteUserData, FirebaseError, void>): UseDataConnectMutationResult<DeleteUserData, undefined>;
export function useDeleteUser(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteUserData, FirebaseError, void>): UseDataConnectMutationResult<DeleteUserData, undefined>;

export function useGetUser(options?: useDataConnectQueryOptions<GetUserData>): UseDataConnectQueryResult<GetUserData, undefined>;
export function useGetUser(dc: DataConnect, options?: useDataConnectQueryOptions<GetUserData>): UseDataConnectQueryResult<GetUserData, undefined>;

export function useListUsers(options?: useDataConnectQueryOptions<ListUsersData>): UseDataConnectQueryResult<ListUsersData, undefined>;
export function useListUsers(dc: DataConnect, options?: useDataConnectQueryOptions<ListUsersData>): UseDataConnectQueryResult<ListUsersData, undefined>;

export function useCreateYardSale(options?: useDataConnectMutationOptions<CreateYardSaleData, FirebaseError, CreateYardSaleVariables>): UseDataConnectMutationResult<CreateYardSaleData, CreateYardSaleVariables>;
export function useCreateYardSale(dc: DataConnect, options?: useDataConnectMutationOptions<CreateYardSaleData, FirebaseError, CreateYardSaleVariables>): UseDataConnectMutationResult<CreateYardSaleData, CreateYardSaleVariables>;

export function useUpdateYardSale(options?: useDataConnectMutationOptions<UpdateYardSaleData, FirebaseError, UpdateYardSaleVariables>): UseDataConnectMutationResult<UpdateYardSaleData, UpdateYardSaleVariables>;
export function useUpdateYardSale(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateYardSaleData, FirebaseError, UpdateYardSaleVariables>): UseDataConnectMutationResult<UpdateYardSaleData, UpdateYardSaleVariables>;

export function useDeleteYardSale(options?: useDataConnectMutationOptions<DeleteYardSaleData, FirebaseError, DeleteYardSaleVariables>): UseDataConnectMutationResult<DeleteYardSaleData, DeleteYardSaleVariables>;
export function useDeleteYardSale(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteYardSaleData, FirebaseError, DeleteYardSaleVariables>): UseDataConnectMutationResult<DeleteYardSaleData, DeleteYardSaleVariables>;

export function useGetYardSale(vars: GetYardSaleVariables, options?: useDataConnectQueryOptions<GetYardSaleData>): UseDataConnectQueryResult<GetYardSaleData, GetYardSaleVariables>;
export function useGetYardSale(dc: DataConnect, vars: GetYardSaleVariables, options?: useDataConnectQueryOptions<GetYardSaleData>): UseDataConnectQueryResult<GetYardSaleData, GetYardSaleVariables>;

export function useListYardSales(options?: useDataConnectQueryOptions<ListYardSalesData>): UseDataConnectQueryResult<ListYardSalesData, undefined>;
export function useListYardSales(dc: DataConnect, options?: useDataConnectQueryOptions<ListYardSalesData>): UseDataConnectQueryResult<ListYardSalesData, undefined>;

export function useCreateItem(options?: useDataConnectMutationOptions<CreateItemData, FirebaseError, CreateItemVariables>): UseDataConnectMutationResult<CreateItemData, CreateItemVariables>;
export function useCreateItem(dc: DataConnect, options?: useDataConnectMutationOptions<CreateItemData, FirebaseError, CreateItemVariables>): UseDataConnectMutationResult<CreateItemData, CreateItemVariables>;

export function useUpdateItem(options?: useDataConnectMutationOptions<UpdateItemData, FirebaseError, UpdateItemVariables>): UseDataConnectMutationResult<UpdateItemData, UpdateItemVariables>;
export function useUpdateItem(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateItemData, FirebaseError, UpdateItemVariables>): UseDataConnectMutationResult<UpdateItemData, UpdateItemVariables>;

export function useDeleteItem(options?: useDataConnectMutationOptions<DeleteItemData, FirebaseError, DeleteItemVariables>): UseDataConnectMutationResult<DeleteItemData, DeleteItemVariables>;
export function useDeleteItem(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteItemData, FirebaseError, DeleteItemVariables>): UseDataConnectMutationResult<DeleteItemData, DeleteItemVariables>;

export function useGetItem(vars: GetItemVariables, options?: useDataConnectQueryOptions<GetItemData>): UseDataConnectQueryResult<GetItemData, GetItemVariables>;
export function useGetItem(dc: DataConnect, vars: GetItemVariables, options?: useDataConnectQueryOptions<GetItemData>): UseDataConnectQueryResult<GetItemData, GetItemVariables>;

export function useListItems(vars: ListItemsVariables, options?: useDataConnectQueryOptions<ListItemsData>): UseDataConnectQueryResult<ListItemsData, ListItemsVariables>;
export function useListItems(dc: DataConnect, vars: ListItemsVariables, options?: useDataConnectQueryOptions<ListItemsData>): UseDataConnectQueryResult<ListItemsData, ListItemsVariables>;

export function useCreateFollow(options?: useDataConnectMutationOptions<CreateFollowData, FirebaseError, CreateFollowVariables>): UseDataConnectMutationResult<CreateFollowData, CreateFollowVariables>;
export function useCreateFollow(dc: DataConnect, options?: useDataConnectMutationOptions<CreateFollowData, FirebaseError, CreateFollowVariables>): UseDataConnectMutationResult<CreateFollowData, CreateFollowVariables>;

export function useDeleteFollow(options?: useDataConnectMutationOptions<DeleteFollowData, FirebaseError, DeleteFollowVariables>): UseDataConnectMutationResult<DeleteFollowData, DeleteFollowVariables>;
export function useDeleteFollow(dc: DataConnect, options?: useDataConnectMutationOptions<DeleteFollowData, FirebaseError, DeleteFollowVariables>): UseDataConnectMutationResult<DeleteFollowData, DeleteFollowVariables>;

export function useListFollows(options?: useDataConnectQueryOptions<ListFollowsData>): UseDataConnectQueryResult<ListFollowsData, undefined>;
export function useListFollows(dc: DataConnect, options?: useDataConnectQueryOptions<ListFollowsData>): UseDataConnectQueryResult<ListFollowsData, undefined>;

export function useSendMessage(options?: useDataConnectMutationOptions<SendMessageData, FirebaseError, SendMessageVariables>): UseDataConnectMutationResult<SendMessageData, SendMessageVariables>;
export function useSendMessage(dc: DataConnect, options?: useDataConnectMutationOptions<SendMessageData, FirebaseError, SendMessageVariables>): UseDataConnectMutationResult<SendMessageData, SendMessageVariables>;

export function useListMessages(options?: useDataConnectQueryOptions<ListMessagesData>): UseDataConnectQueryResult<ListMessagesData, undefined>;
export function useListMessages(dc: DataConnect, options?: useDataConnectQueryOptions<ListMessagesData>): UseDataConnectQueryResult<ListMessagesData, undefined>;
