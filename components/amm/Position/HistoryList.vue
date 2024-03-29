<template lang="pug">
.table-and-filter
  //- TODO: Differ Swap from position
  HistoryFilter.mb-2(v-model="filter" v-if="isMobile")
  el-table.history-table.custom-responsive-table(
    :data='filteredList',
    style='width: 100%;',
    @row-click="onRowClick"
  )
    template(#empty)
      .d-flex.flex-column.align-items-center.gap-30.py-5
        i.el-icon-moon-night.fs-40
        .fs-14.lh-14 {{ $t('Your position history will appear here.') }}
    el-table-column(width="240" class-name="type")
      template(#header)
        HistoryFilter(v-model="filter" v-if="!isMobile")
      template(slot-scope='{row}') {{ renderTitle(row) }}

    el-table-column(:label='$t("Total Value")' width="160" className="total-usd")
      template(slot-scope='{row}')
        .d-flex.flex-column.gap-4
          .mobile-label Total Value
          span ${{ (row.totalUSDValue || row.totalUSDVolume || 0).toFixed(4) }}

    el-table-column(:label='$t("Token Amount")' class-name="token-amount")
      template(slot-scope='{row}')
        .token-amount-inner.d-flex.flex-column.gap-4
          .d-flex.flex-column.gap-2.token-amount-items
            .amount-item
              TokenImage(
                :src='$tokenLogo(row.poolInfo.tokenA.symbol, row.poolInfo.tokenA.contract)',
                height='12'
              )
              .fs-12 {{ row.tokenA }}
              .fs-12 {{ row.poolInfo.tokenA.symbol }}
            .amount-item
              TokenImage(
                :src='$tokenLogo(row.poolInfo.tokenB.symbol, row.poolInfo.tokenB.contract)',
                height='12'
              )
              .fs-12 {{ row.tokenB }}
              .fs-12 {{ row.poolInfo.tokenB.symbol }}

    el-table-column(:label='$t("Time")' align="right" class-name="time")
      template(slot-scope='{row}') {{ row.time | moment('YYYY-MM-DD HH:mm') }}

  infinite-loading(@infinite='loadMore' v-if="canInfinite" :identifier="$store.state.user")
  //div(@click="loadMore" v-if="hasMore") Load More
</template>

<script>
import { mapGetters, mapState } from 'vuex'
import { constructPoolInstance } from '~/utils/amm'

import TokenImage from '~/components/elements/TokenImage'
import HistoryFilter from '~/components/amm/Position/HistoryFilter'

export default {
  components: { TokenImage, HistoryFilter },
  data: () => ({
    filter: 'all',
    page: 1,
    canInfinite: false
  }),

  mounted() {
    this.$store.commit('amm/setHistory', [])
    this.loadMore({
      loaded: () => {},
      complete: () => {},
      reset: () => {}
    })
  },

  computed: {
    listWithPool() {
      return this.history.map((historyItem) => {
        const pool = this.pools.find(({ id }) => historyItem.pool === id)
        return Object.assign(historyItem, { poolInfo: constructPoolInstance(pool) })
      })
    },
    filteredList() {
      // Better to be new to old rather than old to new
      return [...this.listWithPool].sort((a, b) => new Date(b.time) - new Date(a.time)).filter(({ type }) => {
        return this.filter === 'all' ? true : type === this.filter
      })
    },
    ...mapState('amm', ['history', 'pools'])
  },
  methods: {
    renderTitle({ type, poolInfo, tokenA, tokenB }) {
      if (type === 'swap') {
        return `Swap ${poolInfo[tokenA > 0 ? 'tokenA' : 'tokenB'].symbol} for ${poolInfo[tokenB < 0 ? 'tokenB' : 'tokenA'].symbol}`
      }
      if (type === 'mint') return `Add Liquidity ${poolInfo.tokenA.symbol} for ${poolInfo.tokenB.symbol}`
      if (type === 'burn') return `Remove Liquidity ${poolInfo.tokenA.symbol} for ${poolInfo.tokenB.symbol}`
      if (type === 'collect') return `Collect Fees ${poolInfo.tokenA.symbol} for ${poolInfo.tokenB.symbol}`
    },
    onRowClick({ trx_id }) {
      window.open(this.monitorTx(trx_id), '_blank')
    },
    async loadMore($state) {
      console.log('load more', this.page)
      const data = await this.$store.dispatch('amm/fetchPositionsHistory', {
        page: this.page
      })
      this.canInfinite = true
      if (data) this.page++
      if (data && data.length) $state.loaded()
      else $state.complete()
    }
  },
  watch: {
    "$store.state.user"() {
      this.page = 1
    }
  }
}
</script>

<style lang="scss">
.table-and-filter {
  .history-table {
    border-radius: 12px;
    .el-table__header {
      th {
        font-weight: 400 !important;
        font-size: 12px !important;
        color: var(--text-disable);
        .cell {
          padding: 0px 16px;
        }
      }
    }
    .el-table__row {
      cursor: pointer;
    }
    .amount-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.86rem;
    }
  }
  .type {
    color: var(--main-green);
  }
}
@media only screen and (max-width: 1100px) {
  .table-and-filter {
    .history-table{
      .el-table__row {
        grid-template-columns: 1fr;
      }
    }
    .el-table__cell {
      .cell{
        padding: 0 !important;
      }
    }
    .type {
      display: flex;
      justify-content: center;
    }
    .token-amount-items {
      flex-wrap: wrap;
      gap: 4px;
    }
    .token-amount {
      .cell {
        width: 100%;
      }
      &-items {
        flex-direction: row !important;
        justify-content: space-between;
      }
    }
    .time {
      justify-content: flex-end;
    }
    .time .cell{
      display: flex;
      align-items: flex-end;
    }
  }
}
</style>
