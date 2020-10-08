import {
  Component,
  EventEmitter,
  NgZone,
  OnDestroy,
  ViewChild,
  TemplateRef,
} from "@angular/core";
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
    this.onChangeAmount();
    this.getAuctions();

    this.accountSubscribe = this.contractService
      .accountSubscribe()
      .subscribe((account: any) => {
        if (!account || account.balances) {
          this.ngZone.run(() => {
            this.account = account;
            window.dispatchEvent(new Event("resize"));
            if (account) {
              this.onChangeAccount.emit();
              this.contractService.getAuctionInfo().then((result) => {
                this.auctionInfo = result;
                window.dispatchEvent(new Event("resize"));
              });
              // this.contractService.getCurrentAuction().then((auctions) => {
              //   console.log("auctions", auctions);
              // });
              this.contractService.getUserAuctions().then((auctions) => {
                const auctions1 = auctions;

                auctions1.sort((a, b) =>
                  new Date(a.start_date).getDate() <
                  new Date(b.start_date).getDate()
                    ? 1
                    : -1
                );
                // auctions1.sort()

                this.hasAuctionList = auctions1.length !== 0;
                this.auctionsList = auctions1;

                this.referalLink = "";
                // console.log("user auction list", this.auctionsList);
                window.dispatchEvent(new Event("resize"));
              });
              this.contractService.getAuctionPool().then((info) => {
                this.poolInfo = info;
                // console.log("pool info", this.poolInfo);
                this.getAuctionPool();
                this.auctionPoolChecker = true;
              });
            }
          });
        }
      });
    this.tokensDecimals = this.contractService.getCoinsDecimals();
  }

  public scanDate(date) {
    const now = new Date();
    // const utc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);

    const a = moment(date);
    const b = moment(now);

    const leftDays = a.diff(b);

    const showTime = {
      d: moment.utc(leftDays).days(),
      h: moment.utc(leftDays).hours(),
      m: moment.utc(leftDays).minutes(),
      s: moment.utc(leftDays).seconds(),
    };

    return showTime;
  }

  public setAuctionsIntervals(date) {
    const now = new Date();
    // const utc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);

    const a = moment(date);
    const b = moment(now);

    const leftDays = a.diff(b);

    const showTime = {
      d: moment.utc(leftDays).days(),
      h: moment.utc(leftDays).hours(),
      m: moment.utc(leftDays).minutes(),
      s: moment.utc(leftDays).seconds(),
    };

    return showTime;
  }

  public getAuctions() {
    this.contractService.getAuctions().then((res) => {
      this.auctions = res;

      this.auctions.map((auction) => {
        if (auction.time.state === "feature") {
          setInterval(() => {
            auction.time.timer = this.scanDate(auction.time.date);
          }, 1000);
          return auction;
        }
      });

      this.showAuctions = true;
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
  }

  private getAuctionPool() {
    setTimeout(() => {
      this.contractService.getAuctionPool().then((info) => {
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
      })
      .catch(() => {
        auction.withdrawProgress = false;
      });
  }

  private applySort() {
    if (this.currentSort.field) {
      this.auctionsList.sort((a, b) => {
        let aValue = a[this.currentSort.field];
        let bValue = b[this.currentSort.field];
        switch (this.currentSort.field) {
          case "start":
            aValue = aValue.getTime();
            bValue = bValue.getTime();
            break;
          case "token":
          case "eth":
          case "accountTokenBalance":
            aValue = aValue.toNumber();
            bValue = bValue.toNumber();
            break;
        }

        return aValue > bValue
          ? this.currentSort.ask
            ? 1
            : -1
          : aValue < bValue
          ? this.currentSort.ask
            ? -1
            : 1
          : 1;
      });
    } else {
      this.auctionsList.sort((a, b) => {
        return Number(a.auctionId) > Number(b.auctionId) ? 1 : -1;
      });
    }
  }

  public async sortAuctions(type: string, tdate?: string) {
    this.sortData[type] && this.changeSort
      ? (this.changeSort = false)
      : (this.changeSort = true);
    Object.keys(this.sortData).forEach((v) => (this.sortData[v] = v === type));

    console.log(this.auctions);

    this.auctions.sort((auctionsList1, auctionsList2) => {
      let sortauctionsList1: any;
      let sortauctionsList2: any;

      console.log(auctionsList1, auctionsList2);

      if (tdate) {
        sortauctionsList1 =
          tdate === "date"
            ? new Date(auctionsList1[type]).getDate()
            : new Date(auctionsList1[type]).getTime();
        sortauctionsList2 =
          tdate === "date"
            ? new Date(auctionsList2[type]).getDate()
            : new Date(auctionsList2[type]).getTime();
      } else {
        sortauctionsList1 = auctionsList1[type];
        sortauctionsList2 = auctionsList2[type];
      }

      if (this.changeSort) {
        return sortauctionsList1 > sortauctionsList2 ? 1 : -1;
      } else {
        return sortauctionsList1 < sortauctionsList2 ? 1 : -1;
      }
    });
  }

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

  ngOnDestroy() {
    this.auctionPoolChecker = false;
    this.accountSubscribe.unsubscribe();
  }

  public subscribeAccount() {
    this.appComponent.subscribeAccount();
  }
}
