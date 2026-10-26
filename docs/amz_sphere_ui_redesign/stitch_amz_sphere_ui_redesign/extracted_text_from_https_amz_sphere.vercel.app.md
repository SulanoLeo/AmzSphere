[A**AmzSphere** Operations](/)

Workspace

[Overview](/)[SEO & Catalog](/catalog)[PPC Ads Engine](/ppc)[Inventory Hub](/inventory)[Seller Store](/seller-store)[Repricer Monitor](/repricer)[Automation Activity Logs](/activity)[B2B Approvals](/approvals)[How It Works](/how)[SEO Tool Selector](/seo-tools)

Production integration gated

Writes stay disabled until SP-API is enabled and dry-run is off.

Seller operations

# Operations overview

Inventory health and human-review work queue.

Not connectedSync seller dataRefreshBuy Box owned

Mock engine liveSync seller dataRefresh

Catalog itemsCATALOG

—

Seller-linked ASINs · one shared product record each

Sellable unitsINVENTORY

—

Latest inventory snapshots across all marketplaces

Needs optimizationOPTIMIZATION

—

Products below a 70 optimization score

Reorder flagsDAYS OF SUPPLY

—

Below 15 days of supply

Pending approvalsAPPROVALS

—

Revisions awaiting your decision

## 30-day unit velocity

Calculated from ingested daily sales records

Rate-limited

No inventory history ingested yet.

## Execution guard

Control plane status

**Redis/Celery queue**

Tasks are dispatched from the PostgreSQL outbox.

**Amazon write mode**

Requires server-side enablement and human approval.

[Open SEO workspace](/catalog?seller_id=)

## Advertising efficiency

Portfolio ACoS · 30-day trend

ACoS

## Procurement mix

Open and approved workflow value

Open + approved

## Autonomous procurement queue

Trailing 7/30/90-day velocity · replenishment proposals require review

Run inventory scan

SKU| Stock| Velocity 7 / 30 / 90d| Days supply| Vendor| Status  
---|---|---|---|---|---  
Loading catalog…  
  
## Purchase orders awaiting review

Vendor-formatted PDF drafts · approval does not transmit an order

0 pending

No seller data loaded · API credentials remain server-side