/*!
 * Copyright (C) Microsoft Corporation. All rights reserved.
 * This file is auto-generated. Do not modify it manually.
 * Changes to this file may be overwritten.
 */

export const dataSourcesInfo = {
  "re_appuserpreferences": {
    "tableId": "",
    "version": "",
    "primaryKey": "re_appuserpreferenceid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "re_branchs": {
    "tableId": "",
    "version": "",
    "primaryKey": "re_branchid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "re_equipments": {
    "tableId": "",
    "version": "",
    "primaryKey": "re_equipmentid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "re_equipmenttypes": {
    "tableId": "",
    "version": "",
    "primaryKey": "re_equipmenttypeid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "re_estimateequipments": {
    "tableId": "",
    "version": "",
    "primaryKey": "re_estimateequipmentid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "re_estimatepackages": {
    "tableId": "",
    "version": "",
    "primaryKey": "re_estimatepackageid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "re_jobtypes": {
    "tableId": "",
    "version": "",
    "primaryKey": "re_jobtypeid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "re_repairestimates": {
    "tableId": "",
    "version": "",
    "primaryKey": "re_repairestimateid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "re_repairpackages": {
    "tableId": "",
    "version": "",
    "primaryKey": "re_repairpackageid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "retrieveaaduserroles": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Dataverse",
    "apis": {
      "RetrieveAadUserRoles": {
        "path": "/api/data/v9.2/RetrieveAadUserRoles",
        "method": "GET",
        "parameters": [
          {
            "name": "DirectoryObjectId",
            "in": "query",
            "required": true,
            "type": "string",
            "format": "guid"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "array"
          }
        }
      }
    }
  },
  "retrieveuserprivilegebyprivilegename": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Dataverse",
    "apis": {
      "RetrieveUserPrivilegeByPrivilegeName": {
        "path": "/api/data/v9.2/systemusers({id})/Microsoft.Dynamics.CRM.RetrieveUserPrivilegeByPrivilegeName",
        "method": "GET",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "type": "string",
            "format": "guid"
          },
          {
            "name": "PrivilegeName",
            "in": "query",
            "required": true,
            "type": "string"
          },
          {
            "name": "ExcludeTeamBasic",
            "in": "query",
            "required": false,
            "type": "boolean"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      }
    }
  },
  "retrieveuserprivileges": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Dataverse",
    "apis": {
      "RetrieveUserPrivileges": {
        "path": "/api/data/v9.2/systemusers({id})/Microsoft.Dynamics.CRM.RetrieveUserPrivileges",
        "method": "GET",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "type": "string",
            "format": "guid"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      }
    }
  },
  "roles": {
    "tableId": "",
    "version": "",
    "primaryKey": "roleid",
    "dataSourceType": "Dataverse",
    "apis": {}
  }
};
