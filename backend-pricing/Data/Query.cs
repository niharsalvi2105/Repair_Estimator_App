using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using RepairEstimator.Plugins.Infrastructure;

namespace RepairEstimator.Plugins.Data
{
    internal static class Query
    {
        public static List<Entity> All(IOrganizationService service, QueryExpression query, int? maxRows = null)
        {
            var rows = new List<Entity>();
            query.PageInfo = new PagingInfo { PageNumber = 1, Count = 500 };
            while (true)
            {
                var page = service.RetrieveMultiple(query);
                rows.AddRange(page.Entities);
                if (maxRows.HasValue && rows.Count > maxRows.Value)
                    throw new Pricing.PricingException("RE-142", "DRAFT_PROCESSING_BUDGET_EXCEEDED");
                if (!page.MoreRecords) return rows;
                if (maxRows.HasValue && page.Entities.Count == 0)
                    throw new Pricing.PricingException("RE-142", "INVALID_PAGING_RESPONSE");
                query.PageInfo.PageNumber++;
                query.PageInfo.PagingCookie = page.PagingCookie;
            }
        }

        public static Entity First(IOrganizationService service, QueryExpression query)
        {
            query.TopCount = 1;
            var page = service.RetrieveMultiple(query);
            return page.Entities.Count > 0 ? page.Entities[0] : null;
        }

        public static QueryExpression Active(string entity, params string[] columns)
        {
            var query = new QueryExpression(entity) { ColumnSet = new ColumnSet(columns) };
            query.Criteria.AddCondition("statecode", ConditionOperator.Equal, 0);
            return query;
        }

        /// <summary>Restricts rows to those effective on the given date (effective-to is optional).</summary>
        public static void EffectiveOn(QueryExpression query, DateTime date)
        {
            query.Criteria.AddCondition(Names.EffectiveFrom, ConditionOperator.LessEqual, date);
            var to = new FilterExpression(LogicalOperator.Or);
            to.AddCondition(Names.EffectiveTo, ConditionOperator.Null);
            to.AddCondition(Names.EffectiveTo, ConditionOperator.GreaterEqual, date);
            query.Criteria.AddFilter(to);
        }

        public static decimal? Money(Entity e, string attribute)
        {
            var money = e.GetAttributeValue<Money>(attribute);
            return money == null ? (decimal?)null : money.Value;
        }

        public static decimal Money(Entity e, string attribute, decimal fallback)
        {
            return Money(e, attribute) ?? fallback;
        }

        public static decimal? Dec(Entity e, string attribute)
        {
            return e.Contains(attribute) ? e.GetAttributeValue<decimal?>(attribute) : null;
        }
    }
}
