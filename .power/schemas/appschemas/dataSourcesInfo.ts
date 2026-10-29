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
  "re_bandmatrixes": {
    "tableId": "",
    "version": "",
    "primaryKey": "re_bandmatrixid",
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
  "re_countries": {
    "tableId": "",
    "version": "",
    "primaryKey": "re_countryid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "re_customerverticals": {
    "tableId": "",
    "version": "",
    "primaryKey": "re_customerverticalid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "re_draftestimate": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Dataverse",
    "apis": {
      "re_DraftEstimate": {
        "path": "/api/data/v9.2/re_DraftEstimate",
        "method": "POST",
        "parameters": [
          {
            "name": "InputJson",
            "in": "body",
            "required": true,
            "type": "string"
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
  "re_incentiverates": {
    "tableId": "",
    "version": "",
    "primaryKey": "re_incentiverateid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "re_jobsizebands": {
    "tableId": "",
    "version": "",
    "primaryKey": "re_jobsizebandid",
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
  "re_laborrates": {
    "tableId": "",
    "version": "",
    "primaryKey": "re_laborrateid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "re_margingroups": {
    "tableId": "",
    "version": "",
    "primaryKey": "re_margingroupid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "re_marginrules": {
    "tableId": "",
    "version": "",
    "primaryKey": "re_marginruleid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "re_oembandrules": {
    "tableId": "",
    "version": "",
    "primaryKey": "re_oembandruleid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "re_packagecategories": {
    "tableId": "",
    "version": "",
    "primaryKey": "re_packagecategoryid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "re_pricingparameters": {
    "tableId": "",
    "version": "",
    "primaryKey": "re_pricingparameterid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "re_redundancybands": {
    "tableId": "",
    "version": "",
    "primaryKey": "re_redundancybandid",
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
  "re_salesofficeses": {
    "tableId": "",
    "version": "",
    "primaryKey": "re_salesofficesid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "re_scopelibraries": {
    "tableId": "",
    "version": "",
    "primaryKey": "re_scopelibraryid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "re_situationaladjustments": {
    "tableId": "",
    "version": "",
    "primaryKey": "re_situationaladjustmentid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "re_stateprovinces": {
    "tableId": "",
    "version": "",
    "primaryKey": "re_stateprovinceid",
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
  },
  "transactioncurrencies": {
    "tableId": "",
    "version": "",
    "primaryKey": "transactioncurrencyid",
    "dataSourceType": "Dataverse",
    "apis": {}
  },
  "re_choicemetadata": {
    "tableId": "",
    "version": "",
    "primaryKey": "",
    "dataSourceType": "Dataverse",
    "apis": {
      "StringMaps": {
        "path": "/api/data/v9.2/stringmaps?$select=attributename,attributevalue,value,langid,displayorder&$filter={filter}",
        "method": "GET",
        "parameters": [
          {
            "name": "filter",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      },
      "GlobalOptionSet": {
        "path": "/api/data/v9.2/GlobalOptionSetDefinitions(Name='{name}')",
        "method": "GET",
        "parameters": [
          {
            "name": "name",
            "in": "path",
            "required": true,
            "type": "string"
          }
        ],
        "responseInfo": {
          "200": {
            "type": "object"
          }
        }
      }
    }
  }
};
