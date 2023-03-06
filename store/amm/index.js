import JSBI from "jsbi"
import { asset } from 'eos-common'

import cloneDeep from 'lodash/cloneDeep'
import Vue from 'vue'
import { fetchAllRows } from '~/utils/eosjs'
import { tryParsePrice, tryParseCurrencyAmount, parseToken, tryParseTick } from '~/utils/amm'
import { Token, Pool, Tick, CurrencyAmount, Price, Position } from '~/assets/libs/swap-sdk'
import { nameToUint64 } from '~/utils'

export const state = () => ({
  pools: [],
  positions: [],

  // Store only one pool ticks at the time
  ticks: {},

  // TODO move to module
  selectedTokenA: null,
  selectedTokenB: null
})

export const mutations = {
  setPools: (state, pools) => state.pools = pools,
  setPositions: (state, positions) => state.positions = positions,
  setTicks: (state, { poolId, ticks }) => {
    ticks.sort((a, b) => a.id - b.id)
    Vue.set(state.ticks, poolId, ticks)
  },
}

export const actions = {
  async init({ dispatch }) {
    await dispatch('fetchPairs')
    await dispatch('fetchPositions')
  },

  updateTickOfPool({ state, commit }, { poolId, tick }) {
    const ticks = cloneDeep(state.ticks[poolId] ?? [])

    const old = ticks.findIndex(old_tick => old_tick.id == tick.id)

    if (old != -1) {
      if (tick.liquidityGross == 0) {
        ticks.splice(old, 1)
      } else {
        ticks[old] = tick
      }
    } else if (tick.liquidityGross !== 0) {
      ticks.push(tick)
    }

    commit('setTicks', { poolId, ticks })
  },

  async fetchTicksOfPool({ commit, rootState }, poolId) {
    if (isNaN(poolId)) return

    const ticks = await fetchAllRows(this.$rpc, { code: rootState.network.amm.contract, scope: poolId, table: 'ticks' })
    commit('setTicks', { poolId, ticks })
  },

  async fetchPositions({ state, commit, rootState, dispatch }) {
    // TODO Make server api for it
    const owner = rootState.user?.name

    const positions = []

    for (const pool of state.pools) {
      const rows = await fetchAllRows(this.$rpc, {
        code: rootState.network.amm.contract,
        scope: pool.id,
        table: 'positions',
        key_type: 'i64',
        index_position: 3,
        lower_bound: nameToUint64(owner),
        upper_bound: nameToUint64(owner)
      })

      if (!rows) continue

      rows.map(r => r.pool = pool.id)
      positions.push(...rows)
    }

    commit('setPositions', positions)
  },

  async fetchPairs({ state, commit, rootState, dispatch }) {
    const { network } = rootState

    const rows = await fetchAllRows(this.$rpc, { code: network.amm.contract, scope: network.amm.contract, table: 'pools' })
    commit('setPools', rows)

    for (const row of rows) {
      //dispatch('fetchTicksOfPool', row.id)
    }
  }
}

// interface PoolConstructorArgs {
//   id: number,
//   tokenA: Token,
//   tokenB: Token,
//   fee: FeeAmount,
//   sqrtRatioX64: BigintIsh,
//   liquidity: BigintIsh,
//   tickCurrent: number,
//   feeGrowthGlobalAX64: BigintIsh,
//   feeGrowthGlobalBX64: BigintIsh,
//   protocolFeeA: BigintIsh,
//   protocolFeeB: BigintIsh,
//   ticks:
//     | TickDataProvider
//     | (Tick | TickConstructorArgs)[]
// }


export const getters = {
  pools(state, getters, rootState) {
    const pools = []

    for (const row of state.pools) {
      const { tokenA, tokenB, protocolFeeA, protocolFeeB, currSlot: { sqrtPriceX64, tick } } = row

      const ticks = state.ticks[row.id] ?? []

      pools.push(new Pool({
        ...row,

        tokenA: parseToken(tokenA),
        tokenB: parseToken(tokenB),
        ticks,
        sqrtPriceX64,
        tickCurrent: tick
        // protocolFeeA: parseToken(protocolFeeA, protocolFeeB),
        // protocolFeeB: parseToken(protocolFeeA, protocolFeeB)
      }))
    }

    return state.ticks ? pools : pools
  },

  positions(state, getters) {
    const positions = []

    for (const position of state.positions) {
      const poolInstance = getters.pools.find(p => p.id == position.pool)

      positions.push(new Position({
        ...position,
        pool: poolInstance
      }))
    }

    return positions
  }
}