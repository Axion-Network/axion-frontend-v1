import {
  Component,
  EventEmitter,
  NgZone,
  OnDestroy,
  ViewChild,
  TemplateRef,
} from "@angular/core";
import BigNumber from "bignumber.js";
import * as moment from "moment";
import { CookieService } from "ngx-cookie-service";
import { AppComponent } from "../app.component";
import { chackerAuctionPool } from "../params";
import { ContractService } from "../services/contract";

@Component({
  selector: "app-auction-page",
  templateUrl: "./auction-page.component.html",
  styleUrls: ["./auction-page.component.scss"],
})
export class AuctionPageComponent implements OnDestroy {
  @ViewChild("successModal", {
    static: true,
  })
  successModal: TemplateRef<any>;

  public changeSort = true;

  public sortData = {
    id: true,
  } as any;

  public account;
  public tokensDecimals;
  private accountSubscribe;
  public onChangeAccount: EventEmitter<any> = new EventEmitter();

  public formsData: {
    auctionAmount?: string;
  } = {};

  public referalLink = "";
  public referalAddress = "";
  public addressCopy = false;
  public auctionPoolChecker = false;

  public dataSendForm = false;
  public showAuctions = false;
  public hasAuctionList = false;
  public newAuctionDay = false;

  public sendAuctionProgress: boolean;
  public auctionInfo: any;
  public auctionsList: any[];

  public poolInfo: any = {
    axn: 0,
    eth: 0,
  };

  public auctions: any;
  public auctionsIntervals: [];

  public currentSort: any = {};

  constructor(
    private contractService: ContractService,
    private cookieService: CookieService,
    private ngZone: NgZone,
    private appComponent: AppComponent
  ) {
    this.referalAddress = this.cookieService.get("ref");
    // this.onChangeAmount();
    this.getAuctions();

    this.accountSubscribe = this.contractService
      .accountSubscribe()
      .subscribe((account: any) => {
        if (!account || account.balances) {
          this.ngZone.run(() => {
            this.account = account;
            window.dispatchEvent(new Event("resize"));
            if (account) {
              this.onChangeAmount();
              this.onChangeAccount.emit();

              this.contractService.getAuctionInfo().then((result) => {
                this.auctionInfo = result;
                window.dispatchEvent(new Event("resize"));
              });

              this.getUserAuctions();

              this.contractService.getAuctionPool().then((info) => {
                this.poolInfo = info;
                this.getAuctionPool();
                this.auctionPoolChecker = true;
              });
            }
          });
        }
      });
    this.tokensDecimals = this.contractService.getCoinsDecimals();
  }

  ngOnDestroy() {
    this.auctionPoolChecker = false;
    this.accountSubscribe.unsubscribe();
  }

  public scanDate() {
    const a1 = moment(new Date());
    const b1 = moment().add(1, "days");
    b1.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });

    const check = a1.diff(b1);

    if (check > 0) {
      console.log(check);
      this.newAuctionDay = true;
    }

    return moment
      .utc(
        moment(b1, "DD/MM/YYYY HH:mm:ss").diff(
          moment(a1, "DD/MM/YYYY HH:mm:ss")
        )
      )
      .format("HH:mm:ss");
  }

  public userAuctionClick(auction, value) {
    console.log("you clicked region number " + auction, value);
    auction.show[value] = !auction.show[value];
  }

  public getAuctions() {
    this.contractService.getAuctions().then((res) => {
      this.auctions = res;

      this.auctions.map((auction) => {
        if (auction.time.state === "progress") {
          setInterval(() => {
            if (this.newAuctionDay) {
              this.newAuctionDay = false;
              console.log("interval cleared");
              clearInterval();
              this.getAuctions();
            }
            auction.time.timer = this.scanDate();
          }, 1000);
          return auction;
        }
      });

      this.showAuctions = true;
    });
  }

  public getUserAuctions() {
    this.contractService.getUserAuctions().then((auctions) => {
      const auctions1 = auctions;

      auctions1.sort((a, b) =>
        new Date(a.start_date).getDate() < new Date(b.start_date).getDate()
          ? 1
          : -1
      );

      this.hasAuctionList = auctions1.length !== 0;
      this.auctionsList = auctions1;

      this.referalLink = "";
    });
  }

  public resetRef() {
    this.referalAddress = "";
    this.cookieService.set("ref", "");
  }

  public onChangeAmount() {
    this.dataSendForm =
      Number(this.formsData.auctionAmount) <= 0 ||
      this.formsData.auctionAmount === undefined
        ? false
        : true;

    if (
      this.formsData.auctionAmount >
      this.account.balances.ETH.shortBigNumber.toString()
    ) {
      this.formsData.auctionAmount = this.account.balances.ETH.shortBigNumber.toString();
    }

    this.dataSendForm =
      new BigNumber(this.formsData.auctionAmount).toNumber() <= 0 ||
      this.formsData.auctionAmount === undefined
        ? false
        : true;

    if (
      Number(this.formsData.auctionAmount) >
      Number(this.account.balances.ETH.wei)
    ) {
      this.dataSendForm = false;
    }

    if (this.formsData.auctionAmount === "") {
      this.dataSendForm = false;
    }

    if (this.formsData.auctionAmount) {
      if (this.formsData.auctionAmount.indexOf("+") !== -1) {
        this.dataSendForm = false;
      }
    }
  }

  private getAuctionPool() {
    setTimeout(() => {
      this.contractService.getAuctionPool().then((info: any) => {
        if (info.axnToEth === 0) {
          info.axnToEth = this.poolInfo.axnToEth;
        }

        this.poolInfo = info;

        if (this.auctionPoolChecker) {
          this.getAuctionPool();
        }
      });
    }, chackerAuctionPool);
  }

  public sendETHToAuction() {
    this.sendAuctionProgress = true;

    if (this.formsData.auctionAmount === this.account.balances.ETH.wei) {
      this.contractService
        .sendMaxETHToAuction(
          this.formsData.auctionAmount,
          this.cookieService.get("ref")
        )
        .then(({ transactionHash }) => {
          this.contractService.updateETHBalance(true).then(() => {
            this.sendAuctionProgress = false;
            this.formsData.auctionAmount = undefined;
          });
        })
        .catch(() => {
          this.sendAuctionProgress = false;
        });
    } else {
      this.contractService
        .sendETHToAuction(
          this.formsData.auctionAmount,
          this.cookieService.get("ref")
        )
        .then(({ transactionHash }) => {
          this.contractService.updateETHBalance(true).then(() => {
            this.sendAuctionProgress = false;
            this.formsData.auctionAmount = undefined;
          });
        })
        .catch(() => {
          this.sendAuctionProgress = false;
        });
    }
  }

  public generateRefLink() {
    this.referalLink =
      window.location.origin + "/auction?ref=" + this.account.address;
  }

  public onCopied() {
    this.addressCopy = true;

    setTimeout(() => {
      this.addressCopy = false;
    }, 2500);
  }

  public auctionWithdraw(auction) {
    auction.withdrawProgress = true;
    this.contractService
      .withdrawFromAuction(auction.auctionId)
      .then(() => {
        this.contractService.loadAccountInfo();
        auction.withdrawProgress = false;
        auction.status = "complete";
        this.getUserAuctions();
      })
      .catch(() => {
        auction.withdrawProgress = false;
      });
  }

  public subscribeAccount() {
    this.appComponent.subscribeAccount();
  }

  // private applySort() {
  //   if (this.currentSort.field) {
  //     this.auctionsList.sort((a, b) => {
  //       let aValue = a[this.currentSort.field];
  //       let bValue = b[this.currentSort.field];
  //       switch (this.currentSort.field) {
  //         case "start":
  //           aValue = aValue.getTime();
  //           bValue = bValue.getTime();
  //           break;
  //         case "token":
  //         case "eth":
  //         case "accountTokenBalance":
  //           aValue = aValue.toNumber();
  //           bValue = bValue.toNumber();
  //           break;
  //       }

  //       return aValue > bValue
  //         ? this.currentSort.ask
  //           ? 1
  //           : -1
  //         : aValue < bValue
  //         ? this.currentSort.ask
  //           ? -1
  //           : 1
  //         : 1;
  //     });
  //   } else {
  //     this.auctionsList.sort((a, b) => {
  //       return Number(a.auctionId) > Number(b.auctionId) ? 1 : -1;
  //     });
  //   }
  // }

  // public async sortAuctions(type: string, tdate?: string) {
  //   this.sortData[type] && this.changeSort
  //     ? (this.changeSort = false)
  //     : (this.changeSort = true);
  //   Object.keys(this.sortData).forEach((v) => (this.sortData[v] = v === type));

  //   this.auctions.sort((auctionsList1, auctionsList2) => {
  //     let sortauctionsList1: any;
  //     let sortauctionsList2: any;

  //     if (tdate) {
  //       sortauctionsList1 =
  //         tdate === "date"
  //           ? new Date(auctionsList1[type]).getDate()
  //           : new Date(auctionsList1[type]).getTime();
  //       sortauctionsList2 =
  //         tdate === "date"
  //           ? new Date(auctionsList2[type]).getDate()
  //           : new Date(auctionsList2[type]).getTime();
  //     } else {
  //       sortauctionsList1 = auctionsList1[type];
  //       sortauctionsList2 = auctionsList2[type];
  //     }

  //     if (this.changeSort) {
  //       return sortauctionsList1 > sortauctionsList2 ? 1 : -1;
  //     } else {
  //       return sortauctionsList1 < sortauctionsList2 ? 1 : -1;
  //     }
  //   });
  // }

  // public sortAuctions(field) {
  //   const currentUseField = this.currentSort.field;

  //   if (currentUseField !== field) {
  //     this.currentSort.field = field;
  //     this.currentSort.ask = false;
  //   } else {
  //     if (!this.currentSort.ask) {
  //       this.currentSort.ask = true;
  //     } else {
  //       this.currentSort.field = undefined;
  //     }
  //   }
  //   this.applySort();
  // }
}
